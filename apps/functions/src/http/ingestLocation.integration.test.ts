import { createHash } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { describe, it, expect, beforeEach } from 'vitest';
import { clearUserData, emulatorRunning } from '../test-utils.js';
import { handleIngestLocation } from './ingestLocation.js';

const UID = 'test-ingest';
const BEARER_SECRET = 'my-test-secret-token';
const BEARER_HASH = createHash('sha256').update(BEARER_SECRET).digest('hex');

function makeReq(
  overrides: Partial<{
    method: string;
    authorization: string | undefined;
    body: unknown;
  }> = {},
) {
  return {
    method: overrides.method ?? 'POST',
    headers: {
      authorization: overrides.authorization ?? `Bearer ${UID}:${BEARER_SECRET}`,
    },
    body: overrides.body ?? { lat: 40.71, lon: -74.01 },
  };
}

function makeRes() {
  let statusCode = 0;
  let sentBody = '';
  return {
    status(code: number) {
      statusCode = code;
      return {
        send(body: string) {
          sentBody = body;
        },
      };
    },
    get statusCode() {
      return statusCode;
    },
    get sentBody() {
      return sentBody;
    },
  };
}

async function seedBearer() {
  const db = getFirestore();
  await db.doc(`users/${UID}/secrets/iosShortcutBearer`).set({
    bearerHash: BEARER_HASH,
    createdAt: Timestamp.now(),
  });
}

describe.skipIf(!emulatorRunning)('ingestLocation (emulator)', () => {
  beforeEach(async () => {
    await clearUserData(UID);
  });

  it('writes location doc on valid bearer and body', async () => {
    await seedBearer();
    const res = makeRes();

    await handleIngestLocation(makeReq(), res);

    expect(res.statusCode).toBe(204);

    const db = getFirestore();
    const locSnap = await db.collection(`users/${UID}/locations`).get();
    expect(locSnap.size).toBe(1);
    const data = locSnap.docs[0]!.data() as { lat: number; lon: number };
    expect(data.lat).toBe(40.71);
    expect(data.lon).toBe(-74.01);
  });

  it('throws unauthenticated when Authorization header is missing', async () => {
    await expect(
      handleIngestLocation(makeReq({ authorization: undefined }), makeRes()),
    ).rejects.toThrow(HttpsError);
  });

  it('throws unauthenticated for malformed bearer (no colon)', async () => {
    await expect(
      handleIngestLocation(makeReq({ authorization: 'Bearer no-colon-here' }), makeRes()),
    ).rejects.toThrow(HttpsError);
  });

  it('throws unauthenticated for wrong secret (hash mismatch)', async () => {
    await seedBearer();

    await expect(
      handleIngestLocation(makeReq({ authorization: `Bearer ${UID}:wrong-secret` }), makeRes()),
    ).rejects.toThrow(HttpsError);
  });

  it('throws unauthenticated for non-existent UID', async () => {
    await expect(
      handleIngestLocation(
        makeReq({ authorization: `Bearer unknown-uid:${BEARER_SECRET}` }),
        makeRes(),
      ),
    ).rejects.toThrow(HttpsError);
  });

  it('throws for non-POST method', async () => {
    await expect(handleIngestLocation(makeReq({ method: 'GET' }), makeRes())).rejects.toThrow(
      HttpsError,
    );
  });

  it('throws for invalid body (lat out of range)', async () => {
    await seedBearer();

    await expect(
      handleIngestLocation(makeReq({ body: { lat: 999, lon: 0 } }), makeRes()),
    ).rejects.toThrow(HttpsError);
  });

  it('trims collection to 500 newest docs', async () => {
    await seedBearer();
    const db = getFirestore();
    const locRef = db.collection(`users/${UID}/locations`);

    // Firestore batch limit is 500, so split into two batches
    const baseTime = Date.now() - 600_000;
    const batch1 = db.batch();
    for (let i = 0; i < 400; i++) {
      const ts = Timestamp.fromMillis(baseTime + i * 1000);
      batch1.set(locRef.doc(ts.toMillis().toString()), {
        lat: 0,
        lon: 0,
        accuracy: null,
        timestamp: ts,
        source: 'ios-shortcut',
      });
    }
    await batch1.commit();

    const batch2 = db.batch();
    for (let i = 400; i < 501; i++) {
      const ts = Timestamp.fromMillis(baseTime + i * 1000);
      batch2.set(locRef.doc(ts.toMillis().toString()), {
        lat: 0,
        lon: 0,
        accuracy: null,
        timestamp: ts,
        source: 'ios-shortcut',
      });
    }
    await batch2.commit();

    const res = makeRes();
    await handleIngestLocation(makeReq(), res);
    expect(res.statusCode).toBe(204);

    const afterSnap = await locRef.get();
    expect(afterSnap.size).toBe(500);
  });

  it('updates lastUsedAt on bearer doc after successful call', async () => {
    await seedBearer();
    const db = getFirestore();

    const beforeSnap = await db.doc(`users/${UID}/secrets/iosShortcutBearer`).get();
    const beforeData = beforeSnap.data() as { lastUsedAt?: unknown } | undefined;
    expect(beforeData?.lastUsedAt).toBeUndefined();

    await handleIngestLocation(makeReq(), makeRes());

    const afterSnap = await db.doc(`users/${UID}/secrets/iosShortcutBearer`).get();
    const afterData = afterSnap.data() as { lastUsedAt?: unknown } | undefined;
    expect(afterData?.lastUsedAt).toBeDefined();
  });
});
