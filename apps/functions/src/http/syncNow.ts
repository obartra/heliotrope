import type { Override, Rule } from '@heliotrope/schema';
import { getFirestore } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { resolveImage } from '../resolver/index.js';
import type { ResolverOverride, ResolverRule } from '../resolver/types.js';
import { assembleSignals } from '../signals/assembleSignals.js';
import { requireAuthedUser } from './requireAuthedUser.js';

export async function handleSyncNow(
  req: { method: string; headers: { authorization?: string | undefined }; body: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<void> {
  if (req.method !== 'POST') {
    throw new HttpsError('invalid-argument', 'POST only.');
  }

  const { uid } = await requireAuthedUser(req);
  const now = new Date();
  const db = getFirestore();

  const [signals, rulesSnap, overrideSnap, profileSnap] = await Promise.all([
    assembleSignals(uid, now),
    db.collection(`users/${uid}/rules`).orderBy('priority', 'desc').get(),
    db.doc(`users/${uid}/overrides/active`).get(),
    db.doc(`users/${uid}/profile/singleton`).get(),
  ]);

  const rules: ResolverRule[] = rulesSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = d.data() as Rule;
    return {
      id: data.id,
      name: data.name,
      enabled: data.enabled,
      priority: data.priority,
      imageId: data.imageId,
      conditions: data.conditions,
      updatedAt: toDate(data.updatedAt),
    };
  });

  let override: ResolverOverride | null = null;
  if (overrideSnap.exists) {
    const data = overrideSnap.data() as Override;
    override = {
      imageId: data.imageId,
      expiresAt: data.expiresAt ? toDate(data.expiresAt) : null,
      source: data.source,
    };
  }

  const profileData = profileSnap.exists
    ? (profileSnap.data() as { defaultImageId?: string; scheduler?: { timezone?: string } })
    : undefined;
  const timezone = profileData?.scheduler?.timezone ?? null;
  const defaultImageId = profileData?.defaultImageId ?? null;

  const result = resolveImage({
    now,
    timezone,
    signals,
    override,
    rules,
    defaultImageId,
  });

  res.status(200).json({
    chosenImageId: result.chosenImageId,
    reason: result.reason,
    trace: result.trace,
    uploaded: false,
    uploadSkippedReason: null,
  });
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate();
  }
  return new Date(value as string);
}
