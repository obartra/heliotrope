import type { Profile } from '@heliotrope/schema';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';

interface UseProfileReturn {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (fields: Partial<Profile>) => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', user.uid, 'profile', 'singleton');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as Profile);
        } else {
          setProfile(null);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const updateProfile = useCallback(
    async (fields: Partial<Profile>): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const docRef = doc(db, 'users', user.uid, 'profile', 'singleton');
      await updateDoc(docRef, fields);
    },
    [user],
  );

  return { profile, loading, error, updateProfile };
}
