import { describe, it, expect } from 'vitest';
import { getSunTimes } from './sunrise.js';

describe('getSunTimes', () => {
  it('returns sunrise and sunset dates', () => {
    const result = getSunTimes(40.71, -74.01, new Date('2026-06-21T12:00:00Z'));
    expect(result.sunrise).toBeInstanceOf(Date);
    expect(result.sunset).toBeInstanceOf(Date);
    expect(result.sunset.getTime()).toBeGreaterThan(result.sunrise.getTime());
  });

  it('works at equator', () => {
    const result = getSunTimes(0, 0, new Date('2026-03-20T12:00:00Z'));
    expect(result.sunrise).toBeInstanceOf(Date);
    expect(result.sunset).toBeInstanceOf(Date);
  });
});
