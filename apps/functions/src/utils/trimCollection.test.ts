import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trimCollection } from './trimCollection.js';

describe('trimCollection', () => {
  const mockDelete = vi.fn();
  const mockCommit = vi.fn();

  const mockBatch = {
    delete: mockDelete,
    commit: mockCommit,
  };

  const mockGetFirestore = vi.fn(() => ({
    batch: () => mockBatch,
  }));

  vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => mockGetFirestore(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when collection has fewer than keepCount docs', async () => {
    const collectionRef = {
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ size: 3, docs: [{}, {}, {}] }),
    };

    // @ts-expect-error mock collection ref
    const result = await trimCollection(collectionRef, 'timestamp', 10);
    expect(result).toBe(0);
  });
});
