import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchDayOfWeek } from './dayOfWeek.js';

const signals = {} as ResolverSignals;

describe('matchDayOfWeek', () => {
  it('matches single day (Monday)', () => {
    // 2024-07-15 is Monday
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchDayOfWeek({ type: 'dayOfWeek', days: [1] }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('matches multiple days', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchDayOfWeek({ type: 'dayOfWeek', days: [1, 3, 5] }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('matches all days', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchDayOfWeek(
      { type: 'dayOfWeek', days: [1, 2, 3, 4, 5, 6, 7] },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('does not match wrong day', () => {
    // 2024-07-15 is Monday (1), not Tuesday (2)
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchDayOfWeek({ type: 'dayOfWeek', days: [2] }, signals, now, 'UTC');
    expect(result.matched).toBe(false);
  });

  it('Sunday is day 7', () => {
    // 2024-07-14 is Sunday
    const now = new Date('2024-07-14T12:00:00Z');
    const result = matchDayOfWeek({ type: 'dayOfWeek', days: [7] }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('respects timezone for day boundary', () => {
    // 2024-07-15 00:30 UTC = 2024-07-14 (Sunday) in US Eastern
    const now = new Date('2024-07-15T00:30:00Z');
    const result = matchDayOfWeek(
      { type: 'dayOfWeek', days: [7] }, // Sunday
      signals,
      now,
      'America/New_York',
    );
    expect(result.matched).toBe(true);
  });
});
