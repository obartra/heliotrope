import type { Image } from '@heliotrope/schema';
import type { Rule } from '@heliotrope/schema';
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db, storage } from './firebase';

export interface ImageWithUrl {
  data: Image;
  downloadUrl: string;
}

interface UseImagesReturn {
  images: ImageWithUrl[];
  loading: boolean;
  error: string | null;
  uploadImage: (
    blob: Blob,
    imageId: string,
    displayName: string,
    dimensions: { width: number; height: number },
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
  deleteImage: (imageId: string) => Promise<void>;
  deleteImageAndRules: (imageId: string) => Promise<void>;
  reassignRulesAndDelete: (fromImageId: string, toImageId: string) => Promise<void>;
  renameImage: (imageId: string, displayName: string) => Promise<void>;
  updateTags: (imageId: string, tags: string[]) => Promise<void>;
  replaceImage: (
    imageId: string,
    blob: Blob,
    dimensions: { width: number; height: number },
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
  getReferencingRules: (imageId: string) => Promise<Rule[]>;
}

export function useImages(): UseImagesReturn {
  const { user } = useAuth();
  const [images, setImages] = useState<ImageWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setImages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const imagesRef = collection(db, 'users', user.uid, 'images');

    const unsubscribe = onSnapshot(
      imagesRef,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as Image);
        void Promise.all(
          docs.map(async (data) => {
            const storageRef = ref(storage, data.storagePath);
            try {
              const downloadUrl = await getDownloadURL(storageRef);
              return { data, downloadUrl };
            } catch {
              return { data, downloadUrl: '' };
            }
          }),
        ).then((results) => {
          if (!cancelled) {
            setImages(results);
            setError(null);
            setLoading(false);
          }
        });
      },
      (err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  const uploadImage = useCallback(
    async (
      blob: Blob,
      imageId: string,
      displayName: string,
      dimensions: { width: number; height: number },
      onProgress?: (progress: number) => void,
    ): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const storagePath = `users/${user.uid}/avatars/${imageId}.png`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snap) => {
            const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
            onProgress?.(progress);
          },
          reject,
          () => {
            const now = Timestamp.now();
            const imageDoc: Image = {
              id: imageId,
              filename: `${displayName}.png`,
              displayName,
              storagePath,
              contentType: 'image/png',
              bytes: blob.size,
              width: dimensions.width,
              height: dimensions.height,
              tags: [],
              createdAt: now,
              updatedAt: now,
            };
            void setDoc(doc(db, 'users', user.uid, 'images', imageId), imageDoc).then(
              resolve,
              reject,
            );
          },
        );
      });
    },
    [user],
  );

  const deleteImage = useCallback(
    async (imageId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      // Read image doc to get variant paths before deleting
      const imageDocRef = doc(db, 'users', user.uid, 'images', imageId);
      const imageSnap = await getDoc(imageDocRef);
      const imageData = imageSnap.data() as Image | undefined;

      // Delete canonical file
      const canonicalPath = `users/${user.uid}/avatars/${imageId}.png`;
      await deleteObject(ref(storage, canonicalPath));

      // Delete variant files
      if (imageData?.variants) {
        await Promise.all(
          Object.values(imageData.variants).map((variant) =>
            deleteObject(ref(storage, variant.storagePath)).catch(() => {
              // Variant may not exist if trigger has not run yet
            }),
          ),
        );
      }

      await deleteDoc(imageDocRef);
    },
    [user],
  );

  const getReferencingRules = useCallback(
    async (imageId: string): Promise<Rule[]> => {
      if (!user) throw new Error('Not authenticated');

      const rulesRef = collection(db, 'users', user.uid, 'rules');
      const q = query(rulesRef, where('imageId', '==', imageId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data() as Rule);
    },
    [user],
  );

  const deleteImageAndRules = useCallback(
    async (imageId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const rules = await getReferencingRules(imageId);
      if (rules.length > 0) {
        const batch = writeBatch(db);
        for (const rule of rules) {
          batch.delete(doc(db, 'users', user.uid, 'rules', rule.id));
        }
        await batch.commit();
      }
      await deleteImage(imageId);
    },
    [user, getReferencingRules, deleteImage],
  );

  const reassignRulesAndDelete = useCallback(
    async (fromImageId: string, toImageId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const rules = await getReferencingRules(fromImageId);
      if (rules.length > 0) {
        const batch = writeBatch(db);
        const now = Timestamp.now();
        for (const rule of rules) {
          batch.update(doc(db, 'users', user.uid, 'rules', rule.id), {
            imageId: toImageId,
            updatedAt: now,
          });
        }
        await batch.commit();
      }
      await deleteImage(fromImageId);
    },
    [user, getReferencingRules, deleteImage],
  );

  const renameImage = useCallback(
    async (imageId: string, displayName: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      await updateDoc(doc(db, 'users', user.uid, 'images', imageId), {
        displayName,
        updatedAt: Timestamp.now(),
      });
    },
    [user],
  );

  const updateTags = useCallback(
    async (imageId: string, tags: string[]): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      await updateDoc(doc(db, 'users', user.uid, 'images', imageId), {
        tags,
        updatedAt: Timestamp.now(),
      });
    },
    [user],
  );

  const replaceImage = useCallback(
    async (
      imageId: string,
      blob: Blob,
      dimensions: { width: number; height: number },
      onProgress?: (progress: number) => void,
    ): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const storagePath = `users/${user.uid}/avatars/${imageId}.png`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snap) => {
            const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
            onProgress?.(progress);
          },
          reject,
          () => {
            void updateDoc(doc(db, 'users', user.uid, 'images', imageId), {
              bytes: blob.size,
              width: dimensions.width,
              height: dimensions.height,
              contentType: 'image/png',
              updatedAt: Timestamp.now(),
              variants: deleteField(),
            }).then(resolve, reject);
          },
        );
      });
    },
    [user],
  );

  return {
    images,
    loading,
    error,
    uploadImage,
    deleteImage,
    deleteImageAndRules,
    reassignRulesAndDelete,
    renameImage,
    updateTags,
    replaceImage,
    getReferencingRules,
  };
}
