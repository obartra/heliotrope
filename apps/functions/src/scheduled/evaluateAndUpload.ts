import type { Override, Rule } from '@heliotrope/schema';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { resolveImage } from '../resolver/index.js';
import type { ResolverOverride, ResolverRule } from '../resolver/types.js';
import { assembleSignals } from '../signals/assembleSignals.js';
import { uploadAvatar } from '../slack/client.js';
import { decryptToken } from '../slack/encrypt.js';
import { computeHash } from '../slack/hash.js';
import { trimCollection } from '../utils/trimCollection.js';

const DECISIONS_KEEP_COUNT = 1000;

export interface EvalResult {
  chosenImageId: string;
  reason: string;
  trace: unknown[];
  uploaded: boolean;
  uploadSkippedReason: 'hash-match' | 'rate-limit' | null;
}

export async function evaluateAndUpload(uid: string, encryptionKey: string): Promise<EvalResult> {
  const now = new Date();
  const db = getFirestore();

  const [signals, rulesSnap, overrideSnap, profileSnap, slackStateSnap] = await Promise.all([
    assembleSignals(uid, now),
    db.collection(`users/${uid}/rules`).orderBy('priority', 'desc').get(),
    db.doc(`users/${uid}/overrides/active`).get(),
    db.doc(`users/${uid}/profile/singleton`).get(),
    db.doc(`users/${uid}/slackState/singleton`).get(),
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
    ? (profileSnap.data() as {
        defaultImageId?: string;
        scheduler?: { timezone?: string; minSecondsBetweenSlackUploads?: number };
      })
    : undefined;

  const timezone = profileData?.scheduler?.timezone ?? null;
  const defaultImageId = profileData?.defaultImageId ?? null;
  const minSecondsBetweenUploads = profileData?.scheduler?.minSecondsBetweenSlackUploads ?? 300;

  const result = resolveImage({
    now,
    timezone,
    signals,
    override,
    rules,
    defaultImageId,
  });

  // Build signals snapshot for the decision document
  const signalsSnapshot = {
    location: signals.location,
    weather: signals.weather,
    sunrise: { seconds: Math.floor(signals.sunrise.getTime() / 1000), nanoseconds: 0 },
    sunset: { seconds: Math.floor(signals.sunset.getTime() / 1000), nanoseconds: 0 },
    country: signals.country,
    nearbyCities: signals.nearbyCities,
  };

  // Write decision document
  const decisionRef = db.collection(`users/${uid}/decisions`).doc();
  const decision = {
    at: Timestamp.now(),
    chosenImageId: result.chosenImageId,
    reason: result.reason,
    trace: result.trace,
    uploaded: false,
    uploadSkippedReason: null as string | null,
    signalsSnapshot,
  };
  await decisionRef.set(decision);

  // Trim decisions collection
  await trimCollection(db.collection(`users/${uid}/decisions`), 'at', DECISIONS_KEEP_COUNT);

  // If no image was chosen, we're done
  if (!result.chosenImageId) {
    return {
      chosenImageId: result.chosenImageId,
      reason: result.reason,
      trace: result.trace,
      uploaded: false,
      uploadSkippedReason: null,
    };
  }

  // Read image doc to check for a Slack variant
  const imageDocSnap = await db.doc(`users/${uid}/images/${result.chosenImageId}`).get();
  const imageData = imageDocSnap.data() as
    | {
        variants?: Record<string, { storagePath: string; contentType?: string }>;
      }
    | undefined;

  const slackVariant = imageData?.variants?.slack;
  const imagePath = slackVariant?.storagePath ?? `users/${uid}/avatars/${result.chosenImageId}.png`;
  const uploadContentType = slackVariant ? (slackVariant.contentType ?? 'image/jpeg') : 'image/png';

  // Download image bytes (variant if available, canonical as fallback)
  const storageBucket = getStorage().bucket();
  const file = storageBucket.file(imagePath);
  let imageBytes: Buffer;
  try {
    const [contents] = await file.download();
    imageBytes = contents;
  } catch {
    // Image not found in storage, skip upload
    return {
      chosenImageId: result.chosenImageId,
      reason: result.reason,
      trace: result.trace,
      uploaded: false,
      uploadSkippedReason: null,
    };
  }

  const imageHash = computeHash(imageBytes);

  // Read slackState for dedup and rate limiting
  const slackState = slackStateSnap.exists
    ? (slackStateSnap.data() as {
        lastUploadedImageHash?: string;
        lastUploadedAt?: FirebaseFirestore.Timestamp;
      })
    : undefined;

  // Hash dedup check
  if (slackState?.lastUploadedImageHash === imageHash) {
    await decisionRef.update({ uploadSkippedReason: 'hash-match' });
    return {
      chosenImageId: result.chosenImageId,
      reason: result.reason,
      trace: result.trace,
      uploaded: false,
      uploadSkippedReason: 'hash-match',
    };
  }

  // Rate limit check
  if (slackState?.lastUploadedAt) {
    const lastUploadedMs = slackState.lastUploadedAt.toMillis();
    const elapsedSeconds = (now.getTime() - lastUploadedMs) / 1000;
    if (elapsedSeconds < minSecondsBetweenUploads) {
      await decisionRef.update({ uploadSkippedReason: 'rate-limit' });
      return {
        chosenImageId: result.chosenImageId,
        reason: result.reason,
        trace: result.trace,
        uploaded: false,
        uploadSkippedReason: 'rate-limit',
      };
    }
  }

  // Decrypt Slack token
  const slackSecretDoc = await db.doc(`users/${uid}/secrets/slack`).get();
  if (!slackSecretDoc.exists) {
    return {
      chosenImageId: result.chosenImageId,
      reason: result.reason,
      trace: result.trace,
      uploaded: false,
      uploadSkippedReason: null,
    };
  }

  const { tokenCipher } = slackSecretDoc.data() as { tokenCipher: string };
  const slackToken = decryptToken(tokenCipher, encryptionKey);

  // Upload to Slack
  const uploadResult = await uploadAvatar(slackToken, imageBytes, uploadContentType);

  if (uploadResult.ok) {
    await Promise.all([
      decisionRef.update({ uploaded: true }),
      db.doc(`users/${uid}/slackState/singleton`).set({
        lastUploadedImageHash: imageHash,
        lastUploadedAt: Timestamp.now(),
        lastUploadError: null,
      }),
    ]);
    return {
      chosenImageId: result.chosenImageId,
      reason: result.reason,
      trace: result.trace,
      uploaded: true,
      uploadSkippedReason: null,
    };
  }

  // Handle upload failure
  if (uploadResult.error === 'rate_limited') {
    await decisionRef.update({ uploadSkippedReason: 'rate-limit' });
    return {
      chosenImageId: result.chosenImageId,
      reason: result.reason,
      trace: result.trace,
      uploaded: false,
      uploadSkippedReason: 'rate-limit',
    };
  }

  // Other Slack error
  await db.doc(`users/${uid}/slackState/singleton`).set(
    {
      lastUploadError: {
        error: uploadResult.error,
        at: Timestamp.now(),
      },
    },
    { merge: true },
  );

  return {
    chosenImageId: result.chosenImageId,
    reason: result.reason,
    trace: result.trace,
    uploaded: false,
    uploadSkippedReason: null,
  };
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as FirebaseFirestore.Timestamp).toDate();
  }
  return new Date(value as string);
}
