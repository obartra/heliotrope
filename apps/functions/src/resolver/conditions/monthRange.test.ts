import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchMonthRange } from './monthRange.js';

const signals = {} as ResolverSignals;

describe('matchMonthRange', () => {
  it('matches when month is in range', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchMonthRange(
      { type: 'monthRange', fromMonth: 6, toMonth: 8 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('same-month range', () => {
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchMonthRange(
      { type: 'monthRange', fromMonth: 7, toMonth: 7 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('year-wrapping range (Nov to Feb)', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const result = matchMonthRange(
      { type: 'monthRange', fromMonth: 11, toMonth: 2 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('year-wrapping range matches November', () => {
    const now = new Date('2024-11-15T12:00:00Z');
    const result = matchMonthRange(
      { type: 'monthRange', fromMonth: 11, toMonth: 2 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('year-wrapping range does not match June', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    const result = matchMonthRange(
      { type: 'monthRange', fromMonth: 11, toMonth: 2 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('does not match outside range', () => {
    const now = new Date('2024-03-15T12:00:00Z');
    const result = matchMonthRange(
      { type: 'monthRange', fromMonth: 6, toMonth: 8 },
      signals,
      now,
      'UTC',
    );
    expect(result.matched).toBe(false);
  });
});
