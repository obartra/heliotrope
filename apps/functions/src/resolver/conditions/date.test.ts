import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchDate } from './date.js';

const signals = {} as ResolverSignals;

describe('matchDate', () => {
  it('matches exact date', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = matchDate({ type: 'date', monthDay: '01-01' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('does not match different date', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const result = matchDate({ type: 'date', monthDay: '01-01' }, signals, now, 'UTC');
    expect(result.matched).toBe(false);
  });

  it('matches with windowDaysBefore', () => {
    const now = new Date('2024-12-31T12:00:00Z');
    const result = matchDate(
      { type: 'date', monthDay: '01-01', windowDaysBefore: 1 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('matches with windowDaysAfter', () => {
    const now = new Date('2024-01-02T12:00:00Z');
    const result = matchDate(
      { type: 'date', monthDay: '01-01', windowDaysAfter: 1 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('year-boundary wrapping: Dec 31 matches Jan 1 with windowDaysBefore: 1', () => {
    const now = new Date('2024-12-31T12:00:00Z');
    const result = matchDate(
      { type: 'date', monthDay: '01-01', windowDaysBefore: 1 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('respects timezone', () => {
    // Jan 1 00:30 UTC = Dec 31 in US/Eastern (UTC-5)
    const now = new Date('2024-01-01T00:30:00Z');
    const result = matchDate({ type: 'date', monthDay: '12-31' }, signals, now, 'America/New_York');
    expect(result.matched).toBe(true);
  });

  it('does not match outside window', () => {
    const now = new Date('2024-01-05T12:00:00Z');
    const result = matchDate(
      { type: 'date', monthDay: '01-01', windowDaysBefore: 1, windowDaysAfter: 1 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('provides detail string', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const result = matchDate({ type: 'date', monthDay: '01-01' }, signals, now, 'UTC');
    expect(result.detail).toContain('01-01');
  });
});
