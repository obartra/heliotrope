import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchTimeRange } from './timeRange.js';

const signals = {} as ResolverSignals;

describe('matchTimeRange', () => {
  it('matches time within range', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '08:00', toLocal: '17:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('matches at start (inclusive)', () => {
    const now = new Date('2024-07-15T08:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '08:00', toLocal: '17:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('does not match at end (exclusive)', () => {
    const now = new Date('2024-07-15T17:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '08:00', toLocal: '17:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('midnight-crossing range matches late night', () => {
    const now = new Date('2024-07-15T23:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '22:00', toLocal: '06:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('midnight-crossing range matches early morning', () => {
    const now = new Date('2024-07-15T03:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '22:00', toLocal: '06:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('midnight-crossing range does not match midday', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '22:00', toLocal: '06:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('same start and end matches nothing (empty range)', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '12:00', toLocal: '12:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('range within a single hour', () => {
    const now = new Date('2024-07-15T10:30:00Z');
    const result = matchTimeRange(
      { type: 'timeRange', fromLocal: '10:00', toLocal: '11:00' },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });
});
