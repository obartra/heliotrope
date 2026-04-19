import { getFirestore } from 'firebase-admin/firestore';
import type { CollectionReference } from 'firebase-admin/firestore';

/**
 * Keeps only the `keepCount` newest documents in a collection,
 * deleting the rest in batches.
 */
export async function trimCollection(
  collectionRef: CollectionReference,
  orderByField: string,
  keepCount: number,
): Promise<number> {
  const newestSnap = await collectionRef.orderBy(orderByField, 'desc').limit(keepCount).get();

  if (newestSnap.size < keepCount) return 0;

  const lastDoc = newestSnap.docs[newestSnap.size - 1];
  if (!lastDoc) return 0;

  const staleSnap = await collectionRef.orderBy(orderByField, 'desc').startAfter(lastDoc).get();

  if (staleSnap.empty) return 0;

  const db = getFirestore();
  const batch = db.batch();
  for (const docSnap of staleSnap.docs) {
    batch.delete(docSnap.ref);
  }
  await batch.commit();

  return staleSnap.size;
}
