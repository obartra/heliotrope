import { randomBytes } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserData, emulatorRunning } from '../test-utils.js';
import { requireAuthedUser } from './requireAuthedUser.js';
import { handleSetSlackToken } from './setSlackToken.js';

vi.mock('./requireAuthedUser.js', () => ({
  requireAuthedUser: vi.fn(),
}));

const UID = 'test-setslack';
const TEST_ENCRYPTION_KEY = randomBytes(32).toString('base64');

function makeReq(
  overrides: Partial<{ method: string; authorization: string | undefined; body: unknown }> = {},
) {
  return {
    method: overrides.method ?? 'POST',
    headers: { authorization: overrides.authorization ?? 'Bearer valid-id-token' },
    body: overrides.body ?? { token: 'xoxp-test-slack-token' },
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

describe.skipIf(!emulatorRunning)('setSlackToken integration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(requireAuthedUser).mockResolvedValue({ uid: UID, email: 'test@example.com' });
    await clearUserData(UID);
  });

  afterEach(async () => {
    await clearUserData(UID);
  });

  it('validates token via Slack auth.test and stores encrypted token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, user_id: 'U123', team_id: 'T456', team: 'TestWorkspace' }),
      ),
    );

    const res = makeRes();
    await handleSetSlackToken(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as { ok: boolean; slackTeamId: string; slackUserId: string };
    expect(body.ok).toBe(true);
    expect(body.slackTeamId).toBe('T456');
    expect(body.slackUserId).toBe('U123');

    // Verify secrets doc was written
    const db = getFirestore();
    const secretDoc = await db.doc(`users/${UID}/secrets/slack`).get();
    expect(secretDoc.exists).toBe(true);
    const secretData = secretDoc.data() as {
      tokenCipher: string;
      tokenHash: string;
      slackUserId: string;
    };
    expect(secretData.tokenCipher).toBeTruthy();
    expect(secretData.tokenHash).toBeTruthy();
    expect(secretData.slackUserId).toBe('U123');

    // Verify profile was updated
    const profileDoc = await db.doc(`users/${UID}/profile/singleton`).get();
    expect(profileDoc.exists).toBe(true);
    const profileData = profileDoc.data() as {
      slack: { connected: boolean; teamName: string };
    };
    expect(profileData.slack.connected).toBe(true);
    expect(profileData.slack.teamName).toBe('TestWorkspace');
  });

  it('returns early for duplicate token (same hash)', async () => {
    // First call: store the token
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, user_id: 'U123', team_id: 'T456', team: 'TestWorkspace' }),
      ),
    );
    const res1 = makeRes();
    await handleSetSlackToken(makeReq(), res1, TEST_ENCRYPTION_KEY);
    expect(res1.statusCode).toBe(200);

    // Second call with same token: should return early without calling Slack
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res2 = makeRes();
    await handleSetSlackToken(makeReq(), res2, TEST_ENCRYPTION_KEY);
    expect(res2.statusCode).toBe(200);
    const body = res2.jsonBody as { ok: boolean; slackTeamId: string };
    expect(body.ok).toBe(true);
    expect(body.slackTeamId).toBe('T456');
    // fetch should not have been called for the duplicate
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid Slack token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'invalid_auth' })),
    );

    const res = makeRes();
    await handleSetSlackToken(makeReq(), res, TEST_ENCRYPTION_KEY);

    expect(res.statusCode).toBe(400);
    const body = res.jsonBody as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('invalid_auth');
  });

  it('throws on non-POST method', async () => {
    const res = makeRes();
    await expect(
      handleSetSlackToken(makeReq({ method: 'GET' }), res, TEST_ENCRYPTION_KEY),
    ).rejects.toThrow(HttpsError);
  });

  it('throws on unauthenticated request', async () => {
    vi.mocked(requireAuthedUser).mockRejectedValue(
      new HttpsError('unauthenticated', 'Missing or malformed Authorization header.'),
    );
    const res = makeRes();
    await expect(handleSetSlackToken(makeReq(), res, TEST_ENCRYPTION_KEY)).rejects.toThrow(
      HttpsError,
    );
  });

  it('throws on invalid body (missing token)', async () => {
    const res = makeRes();
    await expect(
      handleSetSlackToken(makeReq({ body: {} }), res, TEST_ENCRYPTION_KEY),
    ).rejects.toThrow(HttpsError);
  });

  it('never includes plaintext token in response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, user_id: 'U123', team_id: 'T456', team: 'TestWorkspace' }),
      ),
    );

    const res = makeRes();
    await handleSetSlackToken(makeReq(), res, TEST_ENCRYPTION_KEY);

    const body = res.jsonBody as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('xoxp-test-slack-token');
  });
});
