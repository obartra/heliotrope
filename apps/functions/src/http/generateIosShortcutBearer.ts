import { randomBytes } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { computeHash } from '../slack/hash.js';
import { requireAuthedUser } from './requireAuthedUser.js';

export async function handleGenerateIosShortcutBearer(
  req: { method: string; headers: { authorization?: string | undefined }; body: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<void> {
  if (req.method !== 'POST') {
    throw new HttpsError('invalid-argument', 'POST only.');
  }

  const { uid } = await requireAuthedUser(req);

  const opaque = randomBytes(32).toString('base64url');
  const bearer = `${uid}:${opaque}`;
  const bearerHash = computeHash(opaque);
  const now = Timestamp.now();

  const db = getFirestore();

  // Write hash to secrets (overwrites any previous bearer)
  await db.doc(`users/${uid}/secrets/iosShortcutBearer`).set({
    bearerHash,
    createdAt: now,
    lastUsedAt: null,
  });

  // Copy creation metadata to profile for client display
  await db.doc(`users/${uid}/profile/singleton`).set(
    {
      iosShortcutBearer: {
        createdAt: now,
        lastUsedAt: null,
      },
    },
    { merge: true },
  );

  res.status(200).json({ ok: true, bearer });
}
