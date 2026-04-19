import { randomBytes } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearGeocodingCache } from '../signals/geocoding.js';
import { clearWeatherCache } from '../signals/weather.js';
import { clearUserData, emulatorRunning } from '../test-utils.js';
import { requireAuthedUser } from './requireAuthedUser.js';
import { handleSyncNow } from './syncNow.js';

const UID = 'test-sync';
const TEST_ENCRYPTION_KEY = randomBytes(32).toString('base64');

vi.mock('./requireAuthedUser.js', () => ({
  requireAuthedUser: vi.fn(),
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        download: vi.fn(() => Promise.resolve([Buffer.from([0x89, 0x50, 0x4e, 0x47])])),
      })),
    })),
  })),
}));

const IMAGE_ID = '11111111-1111-1111-1111-111111111111';
const RULE_ID = '22222222-2222-2222-2222-222222222222';
const DEFAULT_IMAGE_ID = '33333333-3333-3333-3333-333333333333';
const OVERRIDE_IMAGE_ID = '44444444-4444-4444-4444-444444444444';

interface SyncNowResponse {
  chosenImageId: string;
  reason: string;
  trace: unknown[];
  uploaded: boolean;
  uploadSkippedReason: string | null;
}

function mockApis() {
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
    return Promise.resolve({ ok: false } as Response);
  });
}

function makeReq(method = 'POST') {
  return {
    method,
    headers: { authorization: 'Bearer fake-id-token' },
    body: {},
  };
}

function makeRes() {
  let statusCode = 0;
  let jsonBody: unknown = null;
  return {
    status(code: number) {
      statusCode = code;
      return {
        json(body: unknown) {
          jsonBody = body;
        },
      };
    },
    get statusCode() {
      return statusCode;
    },
    get jsonBody() {
      return jsonBody;
    },
  };
}

async function seedLocation() {
  const db = getFirestore();
  const ts = Timestamp.fromDate(new Date(Date.now() - 5 * 60_000));
  await db
    .collection(`users/${UID}/locations`)
    .doc(ts.toMillis().toString())
    .set({ lat: 40.71, lon: -74.01, timestamp: ts, source: 'ios-shortcut', accuracy: null });
}

async function seedProfile(defaultImageId: string | null = null) {
  const db = getFirestore();
  const data: Record<string, unknown> = { scheduler: { timezone: 'UTC' } };
  if (defaultImageId) {
    data.defaultImageId = defaultImageId;
  }
  await db.doc(`users/${UID}/profile/singleton`).set(data);
}

async function seedRule(
  conditions: unknown[] = [],
  opts: { enabled?: boolean; priority?: number } = {},
) {
  const db = getFirestore();
  await db.doc(`users/${UID}/rules/${RULE_ID}`).set({
    id: RULE_ID,
    name: 'Test Rule',
    enabled: opts.enabled ?? true,
    priority: opts.priority ?? 10,
    imageId: IMAGE_ID,
    conditions,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

describe.skipIf(!emulatorRunning)('syncNow (emulator)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(requireAuthedUser).mockResolvedValue({ uid: UID, email: 'test@example.com' });
    clearWeatherCache();
    clearGeocodingCache();
    await clearUserData(UID);
  });

  it('returns a trace with matched rule when conditions pass', async () => {
    await seedLocation();
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);
    mockApis();

    const res = makeRes();
    await handleSyncNow(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as SyncNowResponse;
    expect(body.chosenImageId).toBe(IMAGE_ID);
    expect(body.reason).toContain('rule');
    expect(body.trace).toBeInstanceOf(Array);
  });

  it('falls back to default image when no rules exist', async () => {
    await seedLocation();
    await seedProfile(DEFAULT_IMAGE_ID);
    mockApis();

    const res = makeRes();
    await handleSyncNow(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as SyncNowResponse;
    expect(body.chosenImageId).toBe(DEFAULT_IMAGE_ID);
    expect(body.reason).toContain('default');
  });

  it('country condition fails when no location data exists', async () => {
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);

    const res = makeRes();
    await handleSyncNow(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as SyncNowResponse;
    expect(body.chosenImageId).not.toBe(IMAGE_ID);
  });

  it('uses override image when override is active and not expired', async () => {
    await seedLocation();
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);
    mockApis();

    const db = getFirestore();
    await db.doc(`users/${UID}/overrides/active`).set({
      imageId: OVERRIDE_IMAGE_ID,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3600_000)),
      source: 'ui',
    });

    const res = makeRes();
    await handleSyncNow(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as SyncNowResponse;
    expect(body.chosenImageId).toBe(OVERRIDE_IMAGE_ID);
    expect(body.reason).toContain('override');
  });

  it('ignores expired override and evaluates rules', async () => {
    await seedLocation();
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);
    mockApis();

    const db = getFirestore();
    await db.doc(`users/${UID}/overrides/active`).set({
      imageId: OVERRIDE_IMAGE_ID,
      createdAt: Timestamp.fromDate(new Date(Date.now() - 7200_000)),
      expiresAt: Timestamp.fromDate(new Date(Date.now() - 3600_000)),
      source: 'ui',
    });

    const res = makeRes();
    await handleSyncNow(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as SyncNowResponse;
    expect(body.chosenImageId).toBe(IMAGE_ID);
    expect(body.reason).toContain('rule');
  });

  it('throws for non-POST method', async () => {
    await expect(handleSyncNow(makeReq('GET'), makeRes(), TEST_ENCRYPTION_KEY)).rejects.toThrow(
      HttpsError,
    );
  });

  it('throws unauthenticated when requireAuthedUser rejects', async () => {
    vi.mocked(requireAuthedUser).mockRejectedValueOnce(
      new HttpsError('unauthenticated', 'Invalid or expired token.'),
    );

    await expect(handleSyncNow(makeReq(), makeRes(), TEST_ENCRYPTION_KEY)).rejects.toThrow(
      'Invalid or expired token.',
    );
  });
});
