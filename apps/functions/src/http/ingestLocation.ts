import { createHash, timingSafeEqual } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { trimCollection } from '../utils/trimCollection.js';

const LOCATION_KEEP_COUNT = 500;

const IngestBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  timestamp: z.string().datetime().optional(),
  source: z.enum(['ios-shortcut', 'browser']).optional(),
});

export async function handleIngestLocation(
  req: { method: string; headers: { authorization?: string | undefined }; body: unknown },
  res: { status: (code: number) => { send: (body: string) => void } },
): Promise<void> {
  if (req.method !== 'POST') {
    throw new HttpsError('invalid-argument', 'POST only.');
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Missing or malformed Authorization header.');
  }

  const bearer = header.slice('Bearer '.length);
  const separatorIdx = bearer.indexOf(':');
  if (separatorIdx === -1) {
    throw new HttpsError('unauthenticated', 'Invalid bearer format.');
  }

  const uid = bearer.slice(0, separatorIdx);
  const secret = bearer.slice(separatorIdx + 1);

  const db = getFirestore();
  const bearerDoc = await db.doc(`users/${uid}/secrets/iosShortcutBearer`).get();
  if (!bearerDoc.exists) {
    throw new HttpsError('unauthenticated', 'Invalid credentials.');
  }

  const stored = bearerDoc.data() as { bearerHash: string };
  const incomingHash = createHash('sha256').update(secret).digest('hex');

  const storedBuf = Buffer.from(stored.bearerHash, 'hex');
  const incomingBuf = Buffer.from(incomingHash, 'hex');

  if (storedBuf.length !== incomingBuf.length || !timingSafeEqual(storedBuf, incomingBuf)) {
    throw new HttpsError('unauthenticated', 'Invalid credentials.');
  }

  const parsed = IngestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid body: ${parsed.error.message}`);
  }

  const { lat, lon, accuracy, timestamp, source } = parsed.data;
  const ts = timestamp ? Timestamp.fromDate(new Date(timestamp)) : Timestamp.now();

  const locationDoc = {
    lat,
    lon,
    accuracy: accuracy ?? null,
    timestamp: ts,
    source: source ?? 'ios-shortcut',
  };

  const locationsRef = db.collection(`users/${uid}/locations`);
  const docId = ts.toMillis().toString();
  await locationsRef.doc(docId).set(locationDoc);

  await db.doc(`users/${uid}/secrets/iosShortcutBearer`).update({
    lastUsedAt: Timestamp.now(),
  });

  await trimCollection(locationsRef, 'timestamp', LOCATION_KEEP_COUNT);

  res.status(204).send('');
}
