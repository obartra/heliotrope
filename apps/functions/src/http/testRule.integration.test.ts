import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearGeocodingCache } from '../signals/geocoding.js';
import { clearWeatherCache } from '../signals/weather.js';
import { clearUserData, emulatorRunning, testTimestamp } from '../test-utils.js';
import { requireAuthedUser } from './requireAuthedUser.js';
import { handleTestRule } from './testRule.js';

const UID = 'test-testrule';

vi.mock('./requireAuthedUser.js', () => ({
  requireAuthedUser: vi.fn(),
}));

const RULE_ID = '22222222-2222-2222-2222-222222222222';
const IMAGE_ID = '11111111-1111-1111-1111-111111111111';

interface ConditionResult {
  type: string;
  matched: boolean;
  explanation: string;
}

interface TestRuleResponse {
  ruleName: string;
  conditionCount: number;
  allMatched: boolean;
  conditions: ConditionResult[];
  signals: {
    location: unknown;
    weather: unknown;
    country: string | null;
    sunrise: string;
    sunset: string;
  };
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

function makeReq(body: unknown, method = 'POST') {
  return {
    method,
    headers: { authorization: 'Bearer fake-id-token' },
    body,
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

async function seedProfile() {
  const db = getFirestore();
  await db.doc(`users/${UID}/profile/singleton`).set({ scheduler: { timezone: 'UTC' } });
}

async function seedRule(conditions: unknown[]) {
  const db = getFirestore();
  await db.doc(`users/${UID}/rules/${RULE_ID}`).set({
    id: RULE_ID,
    name: 'Test Rule',
    enabled: true,
    priority: 10,
    imageId: IMAGE_ID,
    conditions,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

describe.skipIf(!emulatorRunning)('testRule (emulator)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(requireAuthedUser).mockResolvedValue({ uid: UID, email: 'test@example.com' });
    clearWeatherCache();
    clearGeocodingCache();
    await clearUserData(UID);
  });

  it('returns allMatched: true when all conditions pass (by ruleId)', async () => {
    await seedLocation();
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);
    mockApis();

    const res = makeRes();
    await handleTestRule(makeReq({ ruleId: RULE_ID }), res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as TestRuleResponse;
    expect(body.allMatched).toBe(true);
    expect(body.conditions).toHaveLength(1);
    expect(body.conditions[0]!.matched).toBe(true);
  });

  it('returns allMatched: false when a condition fails', async () => {
    await seedLocation();
    await seedProfile();
    await seedRule([
      { type: 'country', codes: ['US'] },
      { type: 'country', codes: ['JP'] },
    ]);
    mockApis();

    const res = makeRes();
    await handleTestRule(makeReq({ ruleId: RULE_ID }), res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as TestRuleResponse;
    expect(body.allMatched).toBe(false);
    expect(body.conditions[0]!.matched).toBe(true);
    expect(body.conditions[1]!.matched).toBe(false);
  });

  it('accepts inline rule without reading from Firestore', async () => {
    await seedLocation();
    await seedProfile();
    mockApis();

    const now = testTimestamp();
    const inlineRule = {
      id: '55555555-5555-5555-5555-555555555555',
      name: 'Inline Rule',
      enabled: true,
      priority: 5,
      imageId: IMAGE_ID,
      conditions: [{ type: 'country', codes: ['US'] }],
      createdAt: now,
      updatedAt: now,
    };

    const res = makeRes();
    await handleTestRule(makeReq({ rule: inlineRule }), res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as TestRuleResponse;
    expect(body.ruleName).toBe('Inline Rule');
    expect(body.allMatched).toBe(true);
  });

  it('throws not-found for non-existent ruleId', async () => {
    await seedProfile();
    mockApis();

    await expect(handleTestRule(makeReq({ ruleId: 'nonexistent-id' }), makeRes())).rejects.toThrow(
      'Rule not found.',
    );
  });

  it('throws for invalid body (neither ruleId nor rule)', async () => {
    await expect(handleTestRule(makeReq({ something: 'invalid' }), makeRes())).rejects.toThrow(
      HttpsError,
    );
  });

  it('returns matched: false for location-dependent conditions when no location exists', async () => {
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);

    const res = makeRes();
    await handleTestRule(makeReq({ ruleId: RULE_ID }), res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as TestRuleResponse;
    expect(body.allMatched).toBe(false);
    expect(body.conditions[0]!.matched).toBe(false);
  });

  it('includes current signals snapshot in response', async () => {
    await seedLocation();
    await seedProfile();
    await seedRule([{ type: 'country', codes: ['US'] }]);
    mockApis();

    const res = makeRes();
    await handleTestRule(makeReq({ ruleId: RULE_ID }), res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as TestRuleResponse;
    expect(body.signals).toBeDefined();
    expect(body.signals.location).toBeDefined();
    expect(body.signals.weather).toBeDefined();
    expect(body.signals.country).toBe('US');
    expect(body.signals.sunrise).toBeDefined();
    expect(body.signals.sunset).toBeDefined();
  });

  it('throws for non-POST method', async () => {
    await expect(handleTestRule(makeReq({ ruleId: RULE_ID }, 'GET'), makeRes())).rejects.toThrow(
      HttpsError,
    );
  });

  it('throws unauthenticated when requireAuthedUser rejects', async () => {
    vi.mocked(requireAuthedUser).mockRejectedValueOnce(
      new HttpsError('unauthenticated', 'Invalid or expired token.'),
    );

    await expect(handleTestRule(makeReq({ ruleId: RULE_ID }), makeRes())).rejects.toThrow(
      'Invalid or expired token.',
    );
  });
});
