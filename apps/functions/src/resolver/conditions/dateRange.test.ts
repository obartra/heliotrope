import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchDateRange } from './dateRange.js';

const signals = {} as ResolverSignals;

describe('matchDateRange', () => {
  it('matches date within range', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2024-01-01', toISO: '2024-12-31' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('matches single-day range', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2024-06-15', toISO: '2024-06-15' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('matches boundary (fromISO)', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2024-01-01', toISO: '2024-12-31' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('matches boundary (toISO)', () => {
    const now = new Date('2024-12-31T12:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2024-01-01', toISO: '2024-12-31' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('does not match outside range', () => {
    const now = new Date('2025-01-01T12:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2024-01-01', toISO: '2024-12-31' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('fromISO > toISO returns no match', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2024-12-31', toISO: '2024-01-01' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('respects timezone', () => {
    const now = new Date('2024-01-01T04:00:00Z');
    const result = matchDateRange(
      { type: 'dateRange', fromISO: '2023-12-31', toISO: '2023-12-31' },
      signals,
      now,
      'America/New_York',
    );
    expect(result.matched).toBe(true);
  });
});
