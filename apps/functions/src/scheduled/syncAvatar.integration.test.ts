import { randomBytes } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGeocodingCache } from '../signals/geocoding.js';
import { clearWeatherCache } from '../signals/weather.js';
import { encryptToken } from '../slack/encrypt.js';
import { clearUserData, emulatorRunning } from '../test-utils.js';
import { handleSyncAvatar } from './syncAvatar.js';

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        download: vi.fn(() => Promise.resolve([Buffer.from([0x89, 0x50, 0x4e, 0x47])])),
      })),
    })),
  })),
}));

const UID = 'test-syncavatar';
const TEST_ENCRYPTION_KEY = randomBytes(32).toString('base64');
const IMAGE_ID = '11111111-1111-1111-1111-111111111111';
const RULE_ID = '22222222-2222-2222-2222-222222222222';

function mockApis(slackOk = true) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            current: { temperature_2m: 25, precipitation: 0, snowfall: 0, weather_code: 0 },
          }),
      } as Response);
    }
    if (url.includes('geocoding-api.open-meteo.com')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                name: 'TestCity',
                latitude: 40.71,
                longitude: -74.01,
                population: 100000,
                country_code: 'US',
              },
            ],
          }),
      } as Response);
    }
    if (url.includes('slack.com/api/users.setPhoto')) {
      if (slackOk) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
      } as Response);
    }
    return Promise.resolve({ ok: false } as Response);
  });
}

async function seedFullUser(
  opts: {
    slackConnected?: boolean;
    lastUploadedHash?: string;
    lastUploadedAt?: Timestamp;
  } = {},
) {
  const db = getFirestore();
  const now = Timestamp.fromDate(new Date(Date.now() - 5 * 60_000));

  // Profile
  await db.doc(`users/${UID}/profile/singleton`).set({
    displayName: 'Test User',
    email: 'test@example.com',
    slack: {
      connected: opts.slackConnected ?? true,
      teamId: 'T123',
      userId: 'U456',
      teamName: 'Test',
      lastValidatedAt: Timestamp.now(),
    },
    scheduler: { intervalMinutes: 15, minSecondsBetweenSlackUploads: 300 },
    defaultImageId: null,
    createdAt: Timestamp.now(),
  });

  // Location
  await db
    .collection(`users/${UID}/locations`)
    .doc(now.toMillis().toString())
    .set({ lat: 40.71, lon: -74.01, timestamp: now, source: 'ios-shortcut', accuracy: null });

  // Rule
  await db.doc(`users/${UID}/rules/${RULE_ID}`).set({
    id: RULE_ID,
    name: 'Always match',
    enabled: true,
    priority: 10,
    imageId: IMAGE_ID,
    conditions: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Slack secret (encrypted token)
  const tokenCipher = encryptToken('xoxp-test-token', TEST_ENCRYPTION_KEY);
  await db.doc(`users/${UID}/secrets/slack`).set({
    tokenCipher,
    tokenHash: 'fakehash',
    slackUserId: 'U456',
    slackTeamId: 'T123',
    lastValidatedAt: Timestamp.now(),
  });

  // slackState
  if (opts.lastUploadedHash ?? opts.lastUploadedAt) {
    await db.doc(`users/${UID}/slackState/singleton`).set({
      lastUploadedImageHash: opts.lastUploadedHash ?? null,
      lastUploadedAt: opts.lastUploadedAt ?? null,
      lastUploadError: null,
    });
  }
}

describe.skipIf(!emulatorRunning)('syncAvatar (emulator)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    clearWeatherCache();
    clearGeocodingCache();
    await clearUserData(UID);
  });

  afterEach(async () => {
    await clearUserData(UID);
  });

  it('evaluates rules and uploads avatar to Slack', async () => {
    await seedFullUser();
    mockApis();

    await handleSyncAvatar(TEST_ENCRYPTION_KEY);

    // Decision should be written
    const db = getFirestore();
    const decisions = await db
      .collection(`users/${UID}/decisions`)
      .orderBy('at', 'desc')
      .limit(1)
      .get();
    expect(decisions.empty).toBe(false);
    const decision = decisions.docs[0]?.data() as {
      chosenImageId: string;
      uploaded: boolean;
      uploadSkippedReason: string | null;
    };
    expect(decision.chosenImageId).toBe(IMAGE_ID);
    expect(decision.uploaded).toBe(true);

    // slackState should be updated
    const slackState = await db.doc(`users/${UID}/slackState/singleton`).get();
    expect(slackState.exists).toBe(true);
    const stateData = slackState.data() as {
      lastUploadedImageHash: string;
      lastUploadError: unknown;
    };
    expect(stateData.lastUploadedImageHash).toBeTruthy();
    expect(stateData.lastUploadError).toBeNull();
  });

  it('skips upload when image hash matches (dedup)', async () => {
    const { computeHash } = await import('../slack/hash.js');
    const imageHash = computeHash(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await seedFullUser({ lastUploadedHash: imageHash });
    mockApis();

    await handleSyncAvatar(TEST_ENCRYPTION_KEY);

    const db = getFirestore();
    const decisions = await db
      .collection(`users/${UID}/decisions`)
      .orderBy('at', 'desc')
      .limit(1)
      .get();
    const decision = decisions.docs[0]?.data() as {
      uploaded: boolean;
      uploadSkippedReason: string | null;
    };
    expect(decision.uploaded).toBe(false);
    expect(decision.uploadSkippedReason).toBe('hash-match');
  });

  it('skips upload when within rate limit window', async () => {
    await seedFullUser({
      lastUploadedAt: Timestamp.fromDate(new Date(Date.now() - 60_000)), // 1 min ago, within 300s limit
    });
    mockApis();

    await handleSyncAvatar(TEST_ENCRYPTION_KEY);

    const db = getFirestore();
    const decisions = await db
      .collection(`users/${UID}/decisions`)
      .orderBy('at', 'desc')
      .limit(1)
      .get();
    const decision = decisions.docs[0]?.data() as {
      uploaded: boolean;
      uploadSkippedReason: string | null;
    };
    expect(decision.uploaded).toBe(false);
    expect(decision.uploadSkippedReason).toBe('rate-limit');
  });

  it('writes lastUploadError on Slack API failure', async () => {
    await seedFullUser();
    mockApis(false); // Slack returns error

    await handleSyncAvatar(TEST_ENCRYPTION_KEY);

    const db = getFirestore();
    const slackState = await db.doc(`users/${UID}/slackState/singleton`).get();
    expect(slackState.exists).toBe(true);
    const stateData = slackState.data() as {
      lastUploadError: { error: string; at: unknown };
    };
    expect(stateData.lastUploadError.error).toBe('invalid_auth');
  });

  it('skips users without slack.connected', async () => {
    await seedFullUser({ slackConnected: false });
    mockApis();

    await handleSyncAvatar(TEST_ENCRYPTION_KEY);

    // No decisions should be written
    const db = getFirestore();
    const decisions = await db.collection(`users/${UID}/decisions`).get();
    expect(decisions.empty).toBe(true);
  });
});
