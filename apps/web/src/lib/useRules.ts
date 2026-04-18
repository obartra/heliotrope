import type { Rule } from '@heliotrope/schema';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';

interface UseRulesReturn {
  rules: Rule[];
  loading: boolean;
  error: string | null;
  createRule: (rule: Rule) => Promise<void>;
  updateRule: (ruleId: string, updates: Partial<Rule>) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  reorderRules: (ruleId: string, direction: 'up' | 'down') => Promise<void>;
}

export function useRules(): UseRulesReturn {
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRules([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const rulesRef = collection(db, 'users', user.uid, 'rules');
    const q = query(rulesRef, orderBy('priority', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!cancelled) {
          setRules(snapshot.docs.map((d) => d.data() as Rule));
          setError(null);
          setLoading(false);
        }
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

  const createRule = useCallback(
    async (rule: Rule): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await setDoc(doc(db, 'users', user.uid, 'rules', rule.id), rule);
    },
    [user],
  );

  const updateRule = useCallback(
    async (ruleId: string, updates: Partial<Rule>): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await updateDoc(doc(db, 'users', user.uid, 'rules', ruleId), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    },
    [user],
  );

  const deleteRule = useCallback(
    async (ruleId: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await deleteDoc(doc(db, 'users', user.uid, 'rules', ruleId));
    },
    [user],
  );

  const reorderRules = useCallback(
    async (ruleId: string, direction: 'up' | 'down'): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const idx = rules.findIndex((r) => r.id === ruleId);
      if (idx === -1) return;

      // Rules are sorted by priority desc, so "up" means higher priority (swap with previous)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= rules.length) return;

      // Reorder the array
      const reordered = [...rules];
      const item = reordered[idx];
      const swapItem = reordered[swapIdx];
      if (!item || !swapItem) return;
      reordered[idx] = swapItem;
      reordered[swapIdx] = item;

      // Re-space priorities in steps of 10 (highest first)
      const batch = writeBatch(db);
      const now = Timestamp.now();
      for (let i = 0; i < reordered.length; i++) {
        const rule = reordered[i];
        if (!rule) continue;
        const newPriority = (reordered.length - i) * 10;
        batch.update(doc(db, 'users', user.uid, 'rules', rule.id), {
          priority: newPriority,
          updatedAt: now,
        });
      }
      await batch.commit();
    },
    [user, rules],
  );

  return {
    rules,
    loading,
    error,
    createRule,
    updateRule,
    deleteRule,
    reorderRules,
  };
}
