import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchTimeOfDay } from './timeOfDay.js';

function makeSignals(sunrise: string, sunset: string): ResolverSignals {
  return {
    location: null,
    weather: null,
    sunrise: new Date(sunrise),
    sunset: new Date(sunset),
    country: null,
    nearbyCities: [],
  };
}

describe('matchTimeOfDay', () => {
  it('matches day when between sunrise and sunset', () => {
    const signals = makeSignals('2024-07-15T06:00:00Z', '2024-07-15T20:00:00Z');
    const now = new Date('2024-07-15T12:00:00Z');
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'day' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('matches night when before sunrise', () => {
    const signals = makeSignals('2024-07-15T06:00:00Z', '2024-07-15T20:00:00Z');
    const now = new Date('2024-07-15T04:00:00Z');
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'night' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('matches night when after sunset', () => {
    const signals = makeSignals('2024-07-15T06:00:00Z', '2024-07-15T20:00:00Z');
    const now = new Date('2024-07-15T21:00:00Z');
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'night' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('exact sunrise is day (inclusive)', () => {
    const signals = makeSignals('2024-07-15T06:00:00Z', '2024-07-15T20:00:00Z');
    const now = new Date('2024-07-15T06:00:00Z');
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'day' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('exact sunset is night (exclusive of sunset for day)', () => {
    const signals = makeSignals('2024-07-15T06:00:00Z', '2024-07-15T20:00:00Z');
    const now = new Date('2024-07-15T20:00:00Z');
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'night' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });

  it('does not match day when it is night', () => {
    const signals = makeSignals('2024-07-15T06:00:00Z', '2024-07-15T20:00:00Z');
    const now = new Date('2024-07-15T22:00:00Z');
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'day' }, signals, now, 'UTC');
    expect(result.matched).toBe(false);
  });

  it('polar edge: 24h day (sunrise == sunset at midnight)', () => {
    const signals = makeSignals('2024-06-21T00:00:00Z', '2024-06-21T00:00:00Z');
    const now = new Date('2024-06-21T12:00:00Z');
    // sunrise <= now is true, now < sunset is false (since sunset == sunrise == midnight)
    // So isDay is false, this is night
    const result = matchTimeOfDay({ type: 'timeOfDay', value: 'night' }, signals, now, 'UTC');
    expect(result.matched).toBe(true);
  });
});
