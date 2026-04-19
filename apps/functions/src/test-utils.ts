import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_PORT = 8080;
const PROJECT_ID = 'heliotrope-integration-test';

export const emulatorRunning = await fetch(`http://localhost:${FIRESTORE_PORT}`).then(
  () => true,
  () => false,
);

if (!emulatorRunning && process.env.CI) {
  throw new Error(
    'Firestore emulator is not running but CI=true. Integration tests must not be silently skipped in CI.',
  );
}

if (emulatorRunning && getApps().length === 0) {
  process.env.FIRESTORE_EMULATOR_HOST = `localhost:${FIRESTORE_PORT}`;
  initializeApp({ projectId: PROJECT_ID });
}

/**
 * Delete all subcollections for a specific user. Scoped to avoid
 * interfering with other test files running in parallel.
 */
export async function clearUserData(uid: string): Promise<void> {
  const db = getFirestore();
  const subcollections = [
    'locations',
    'rules',
    'secrets',
    'overrides',
    'profile',
    'decisions',
    'slackState',
    'images',
  ];

  for (const sub of subcollections) {
    const snap = await db.collection(`users/${uid}/${sub}`).get();
    if (snap.empty) continue;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

/** Firestore Timestamp-compatible object for test data. */
export function testTimestamp(date: Date = new Date()): { seconds: number; nanoseconds: number } {
  return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
}
