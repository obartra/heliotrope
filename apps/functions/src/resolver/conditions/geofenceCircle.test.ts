import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchGeofenceCircle } from './geofenceCircle.js';

function makeSignals(lat: number, lon: number, ageMinutes = 5): ResolverSignals {
  return {
    location: { lat, lon, ageMinutes },
    weather: null,
    sunrise: new Date(),
    sunset: new Date(),
    country: null,
    nearbyCities: [],
  };
}

const nullLocation: ResolverSignals = {
  location: null,
  weather: null,
  sunrise: new Date(),
  sunset: new Date(),
  country: null,
  nearbyCities: [],
};

describe('matchGeofenceCircle', () => {
  it('matches point inside circle', () => {
    const signals = makeSignals(40.7128, -74.006);
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [40.7128, -74.006], radiusMeters: 1000 },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('does not match point outside circle', () => {
    const signals = makeSignals(41.0, -74.0);
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [40.7128, -74.006], radiusMeters: 1000 },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('point on boundary matches (<=)', () => {
    // Same point, radius 0 would be edge case, but distance 0 <= any positive radius
    const signals = makeSignals(40.7128, -74.006);
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [40.7128, -74.006], radiusMeters: 1 },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('returns no location available when location is null', () => {
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [0, 0], radiusMeters: 1000 },
      nullLocation,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('no location available');
  });

  it('returns location stale when age > 120 minutes', () => {
    const signals = makeSignals(40.7, -74.0, 200);
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [40.7, -74.0], radiusMeters: 1000 },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('location stale');
  });

  it('location at exactly 120 minutes is not stale', () => {
    const signals = makeSignals(40.7128, -74.006, 120);
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [40.7128, -74.006], radiusMeters: 1000 },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('includes distance in detail', () => {
    const signals = makeSignals(40.7128, -74.006);
    const result = matchGeofenceCircle(
      { type: 'geofenceCircle', center: [40.7128, -74.006], radiusMeters: 1000 },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.detail).toContain('m from center');
  });
});
