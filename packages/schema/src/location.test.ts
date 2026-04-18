import { describe, it, expect } from 'vitest';
import { LocationSchema } from './location.js';

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

const ts = { seconds: 1700000000, nanoseconds: 0 };

const validLocation = {
  lat: 40.7128,
  lon: -74.006,
  accuracy: 10,
  timestamp: ts,
  source: 'ios-shortcut' as const,
};

describe('LocationSchema', () => {
  it('parses a valid location', () => {
    expect(LocationSchema.parse(validLocation)).toEqual(validLocation);
  });

  it('accepts browser source', () => {
    expect(LocationSchema.parse({ ...validLocation, source: 'browser' })).toBeTruthy();
  });

  it('accepts null accuracy', () => {
    expect(LocationSchema.parse({ ...validLocation, accuracy: null })).toBeTruthy();
  });

  it('accepts zero accuracy', () => {
    expect(LocationSchema.parse({ ...validLocation, accuracy: 0 })).toBeTruthy();
  });

  it('accepts boundary latitudes', () => {
    expect(LocationSchema.parse({ ...validLocation, lat: -90 })).toBeTruthy();
    expect(LocationSchema.parse({ ...validLocation, lat: 90 })).toBeTruthy();
  });

  it('accepts boundary longitudes', () => {
    expect(LocationSchema.parse({ ...validLocation, lon: -180 })).toBeTruthy();
    expect(LocationSchema.parse({ ...validLocation, lon: 180 })).toBeTruthy();
  });

  it('rejects latitude out of range', () => {
    expect(() => LocationSchema.parse({ ...validLocation, lat: 91 })).toThrow();
    expect(() => LocationSchema.parse({ ...validLocation, lat: -91 })).toThrow();
  });

  it('rejects longitude out of range', () => {
    expect(() => LocationSchema.parse({ ...validLocation, lon: 181 })).toThrow();
    expect(() => LocationSchema.parse({ ...validLocation, lon: -181 })).toThrow();
  });

  it('rejects negative accuracy', () => {
    expect(() => LocationSchema.parse({ ...validLocation, accuracy: -1 })).toThrow();
  });

  it('rejects invalid source', () => {
    expect(() => LocationSchema.parse({ ...validLocation, source: 'gps' })).toThrow();
  });

  it('rejects missing lat', () => {
    expect(() => LocationSchema.parse(omit(validLocation, 'lat'))).toThrow();
  });

  it('rejects missing lon', () => {
    expect(() => LocationSchema.parse(omit(validLocation, 'lon'))).toThrow();
  });

  it('rejects missing timestamp', () => {
    expect(() => LocationSchema.parse(omit(validLocation, 'timestamp'))).toThrow();
  });

  it('rejects missing source', () => {
    expect(() => LocationSchema.parse(omit(validLocation, 'source'))).toThrow();
  });

  it('rejects string lat', () => {
    expect(() => LocationSchema.parse({ ...validLocation, lat: '40.7' })).toThrow();
  });
});
