import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchNearCity } from './nearCity.js';

function makeSignals(
  nearbyCities: ResolverSignals['nearbyCities'],
  ageMinutes = 5,
): ResolverSignals {
  return {
    location: { lat: 0, lon: 0, ageMinutes },
    weather: null,
    sunrise: new Date(),
    sunset: new Date(),
    country: null,
    nearbyCities,
  };
}

describe('matchNearCity', () => {
  it('matches city meeting both criteria', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100000, maxDistanceKm: 50 },
      makeSignals([{ name: 'Big City', population: 500000, distanceKm: 10 }]),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('city at exact max distance matches', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100, maxDistanceKm: 25 },
      makeSignals([{ name: 'Town', population: 200, distanceKm: 25 }]),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('city beyond max distance does not match', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100, maxDistanceKm: 25 },
      makeSignals([{ name: 'Far Town', population: 500, distanceKm: 26 }]),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('city below population threshold does not match', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100000, maxDistanceKm: 50 },
      makeSignals([{ name: 'Small Town', population: 5000, distanceKm: 5 }]),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('no cities in signal data', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100, maxDistanceKm: 50 },
      makeSignals([]),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('no nearby cities in signal data');
  });

  it('returns no location available when location is null', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100, maxDistanceKm: 50 },
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
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100, maxDistanceKm: 50 },
      makeSignals([{ name: 'City', population: 500000, distanceKm: 10 }], 200),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('location stale');
  });

  it('city at exact population threshold matches', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 500000, maxDistanceKm: 50 },
      makeSignals([{ name: 'Exact', population: 500000, distanceKm: 10 }]),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('includes city name in detail on match', () => {
    const result = matchNearCity(
      { type: 'nearCity', minPopulation: 100, maxDistanceKm: 50 },
      makeSignals([{ name: 'Springfield', population: 150000, distanceKm: 8 }]),
      new Date(),
      'UTC',
    );
    expect(result.detail).toContain('Springfield');
  });
});
