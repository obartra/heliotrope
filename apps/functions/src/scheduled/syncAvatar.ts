import { getFirestore } from 'firebase-admin/firestore';
import { evaluateAndUpload } from './evaluateAndUpload.js';

export async function handleSyncAvatar(encryptionKey: string): Promise<void> {
  const db = getFirestore();

  // Find all users with slack.connected: true
  // v1: exactly one user, but query supports multiple
  const usersSnap = await db.collectionGroup('profile').where('slack.connected', '==', true).get();

  for (const doc of usersSnap.docs) {
    // Profile path is users/{uid}/profile/singleton
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;

    try {
      await evaluateAndUpload(uid, encryptionKey);
    } catch (err) {
      // Log and continue to next user
      console.error(`syncAvatar failed for user ${uid}:`, err);
    }
  }
}
