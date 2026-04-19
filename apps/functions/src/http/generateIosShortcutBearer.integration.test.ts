import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUserData, emulatorRunning } from '../test-utils.js';
import { handleGenerateIosShortcutBearer } from './generateIosShortcutBearer.js';
import { requireAuthedUser } from './requireAuthedUser.js';

vi.mock('./requireAuthedUser.js', () => ({
  requireAuthedUser: vi.fn(),
}));

const UID = 'test-genbearer';

function makeReq(
  overrides: Partial<{ method: string; authorization: string | undefined; body: unknown }> = {},
) {
  return {
    method: overrides.method ?? 'POST',
    headers: { authorization: overrides.authorization ?? 'Bearer valid-id-token' },
    body: overrides.body ?? {},
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

describe.skipIf(!emulatorRunning)('generateIosShortcutBearer integration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(requireAuthedUser).mockResolvedValue({ uid: UID, email: 'test@example.com' });
    await clearUserData(UID);
  });

  afterEach(async () => {
    await clearUserData(UID);
  });

  it('generates a bearer and stores hashed version in secrets', async () => {
    const res = makeRes();
    await handleGenerateIosShortcutBearer(makeReq(), res);

    expect(res.statusCode).toBe(200);
    const body = res.jsonBody as { ok: boolean; bearer: string };
    expect(body.ok).toBe(true);
    expect(body.bearer).toMatch(new RegExp(`^${UID}:.+$`));

    // Verify the hash matches
    const opaque = body.bearer.split(':').slice(1).join(':');
    const expectedHash = createHash('sha256').update(opaque).digest('hex');
    const db = getFirestore();
    const secretDoc = await db.doc(`users/${UID}/secrets/iosShortcutBearer`).get();
    expect(secretDoc.exists).toBe(true);
    const secretData = secretDoc.data() as { bearerHash: string; lastUsedAt: unknown };
    expect(secretData.bearerHash).toBe(expectedHash);
    expect(secretData.lastUsedAt).toBeNull();
  });

  it('copies createdAt to profile document', async () => {
    const res = makeRes();
    await handleGenerateIosShortcutBearer(makeReq(), res);

    const db = getFirestore();
    const profileDoc = await db.doc(`users/${UID}/profile/singleton`).get();
    expect(profileDoc.exists).toBe(true);
    const profileData = profileDoc.data() as {
      iosShortcutBearer: { createdAt: unknown; lastUsedAt: unknown };
    };
    expect(profileData.iosShortcutBearer.createdAt).toBeTruthy();
    expect(profileData.iosShortcutBearer.lastUsedAt).toBeNull();
  });

  it('regeneration overwrites previous bearer', async () => {
    const res1 = makeRes();
    await handleGenerateIosShortcutBearer(makeReq(), res1);
    const bearer1 = (res1.jsonBody as { bearer: string }).bearer;

    const res2 = makeRes();
    await handleGenerateIosShortcutBearer(makeReq(), res2);
    const bearer2 = (res2.jsonBody as { bearer: string }).bearer;

    expect(bearer1).not.toBe(bearer2);

    // Old bearer should not match
    const db = getFirestore();
    const secretDoc = await db.doc(`users/${UID}/secrets/iosShortcutBearer`).get();
    const storedHash = (secretDoc.data() as { bearerHash: string }).bearerHash;
    const opaque1 = bearer1.split(':').slice(1).join(':');
    const hash1 = createHash('sha256').update(opaque1).digest('hex');
    expect(storedHash).not.toBe(hash1);

    const opaque2 = bearer2.split(':').slice(1).join(':');
    const hash2 = createHash('sha256').update(opaque2).digest('hex');
    expect(storedHash).toBe(hash2);
  });

  it('bearer value is only returned once (in the response)', async () => {
    const res = makeRes();
    await handleGenerateIosShortcutBearer(makeReq(), res);

    const body = res.jsonBody as { bearer: string };
    const bearer = body.bearer;

    // Secrets doc should NOT contain the plaintext bearer
    const db = getFirestore();
    const secretDoc = await db.doc(`users/${UID}/secrets/iosShortcutBearer`).get();
    const secretData = JSON.stringify(secretDoc.data());
    const opaque = bearer.split(':').slice(1).join(':');
    expect(secretData).not.toContain(opaque);
  });

  it('throws on non-POST method', async () => {
    const res = makeRes();
    await expect(handleGenerateIosShortcutBearer(makeReq({ method: 'GET' }), res)).rejects.toThrow(
      HttpsError,
    );
  });

  it('throws on unauthenticated request', async () => {
    vi.mocked(requireAuthedUser).mockRejectedValue(
      new HttpsError('unauthenticated', 'Missing or malformed Authorization header.'),
    );
    const res = makeRes();
    await expect(handleGenerateIosShortcutBearer(makeReq(), res)).rejects.toThrow(HttpsError);
  });
});
