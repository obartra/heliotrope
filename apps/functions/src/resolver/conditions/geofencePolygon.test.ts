import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchGeofencePolygon } from './geofencePolygon.js';

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

// A simple square: (0,0), (10,0), (10,10), (0,10)
const square: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe('matchGeofencePolygon', () => {
  it('matches point inside polygon', () => {
    const signals = makeSignals(5, 5);
    const result = matchGeofencePolygon(
      { type: 'geofencePolygon', points: square },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('does not match point outside polygon', () => {
    const signals = makeSignals(15, 15);
    const result = matchGeofencePolygon(
      { type: 'geofencePolygon', points: square },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('concave polygon: point inside concavity is outside', () => {
    // L-shaped polygon
    const concave: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 5],
      [5, 5],
      [5, 10],
      [0, 10],
    ];
    const signals = makeSignals(7, 7); // inside the "notch"
    const result = matchGeofencePolygon(
      { type: 'geofencePolygon', points: concave },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('minimum-point triangle', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [10, 0],
      [5, 10],
    ];
    const signals = makeSignals(3, 3);
    const result = matchGeofencePolygon(
      { type: 'geofencePolygon', points: triangle },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('returns no location available when location is null', () => {
    const result = matchGeofencePolygon(
      { type: 'geofencePolygon', points: square },
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
    const signals = makeSignals(5, 5, 200);
    const result = matchGeofencePolygon(
      { type: 'geofencePolygon', points: square },
      signals,
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('location stale');
  });
});
