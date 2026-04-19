import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validateToken } from '../slack/client.js';
import { encryptToken } from '../slack/encrypt.js';
import { computeHash } from '../slack/hash.js';
import { requireAuthedUser } from './requireAuthedUser.js';

const SetSlackTokenBodySchema = z.object({
  token: z.string().min(1),
});

export async function handleSetSlackToken(
  req: { method: string; headers: { authorization?: string | undefined }; body: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  encryptionKey: string,
): Promise<void> {
  if (req.method !== 'POST') {
    throw new HttpsError('invalid-argument', 'POST only.');
  }

  const { uid } = await requireAuthedUser(req);

  const parsed = SetSlackTokenBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid body: ${parsed.error.message}`);
  }

  const { token } = parsed.data;
  const tokenHash = computeHash(token);
  const db = getFirestore();
  const secretsDoc = db.doc(`users/${uid}/secrets/slack`);

  // Check for duplicate token submission
  const existing = await secretsDoc.get();
  if (existing.exists) {
    const data = existing.data() as {
      tokenHash?: string;
      slackUserId?: string;
      slackTeamId?: string;
    };
    if (data.tokenHash === tokenHash) {
      res.status(200).json({
        ok: true,
        slackTeamId: data.slackTeamId ?? null,
        slackUserId: data.slackUserId ?? null,
      });
      return;
    }
  }

  // Validate with Slack
  const result = await validateToken(token);
  if (!result.ok) {
    res.status(400).json({ ok: false, error: result.error });
    return;
  }

  // Encrypt and store
  const tokenCipher = encryptToken(token, encryptionKey);
  const now = Timestamp.now();

  await secretsDoc.set({
    tokenCipher,
    tokenHash,
    slackUserId: result.userId,
    slackTeamId: result.teamId,
    lastValidatedAt: now,
  });

  // Update profile with connection metadata
  await db.doc(`users/${uid}/profile/singleton`).set(
    {
      slack: {
        connected: true,
        teamId: result.teamId,
        userId: result.userId,
        teamName: result.teamName,
        lastValidatedAt: now,
      },
    },
    { merge: true },
  );

  res.status(200).json({
    ok: true,
    slackTeamId: result.teamId,
    slackUserId: result.userId,
  });
}
