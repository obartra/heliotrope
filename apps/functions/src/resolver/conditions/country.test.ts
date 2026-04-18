import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchCountry } from './country.js';

function makeSignals(country: string | null, ageMinutes = 5): ResolverSignals {
  return {
    location: country !== null ? { lat: 0, lon: 0, ageMinutes } : null,
    weather: null,
    sunrise: new Date(),
    sunset: new Date(),
    country,
    nearbyCities: [],
  };
}

describe('matchCountry', () => {
  it('matches single code', () => {
    const result = matchCountry(
      { type: 'country', codes: ['US'] },
      makeSignals('US'),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('matches multi-code list', () => {
    const result = matchCountry(
      { type: 'country', codes: ['US', 'CA', 'MX'] },
      makeSignals('CA'),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('does not match when country is not in list', () => {
    const result = matchCountry(
      { type: 'country', codes: ['US'] },
      makeSignals('GB'),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('case-insensitive comparison', () => {
    const result = matchCountry(
      { type: 'country', codes: ['US'] },
      makeSignals('us'),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('returns no location available when location is null', () => {
    const result = matchCountry(
      { type: 'country', codes: ['US'] },
      {
        location: null,
        weather: null,
        sunrise: new Date(),
        sunset: new Date(),
        country: null,
        nearbyCities: [],
      },
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('no location available');
  });

  it('returns location stale when age > 120 minutes', () => {
    const result = matchCountry(
      { type: 'country', codes: ['US'] },
      makeSignals('US', 200),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('location stale');
  });

  it('returns no country data when country signal is null but location is fresh', () => {
    const signals: ResolverSignals = {
      location: { lat: 0, lon: 0, ageMinutes: 5 },
      weather: null,
      sunrise: new Date(),
      sunset: new Date(),
      country: null,
      nearbyCities: [],
    };
    const result = matchCountry({ type: 'country', codes: ['US'] }, signals, new Date(), 'UTC');
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('no country data available');
  });
});
