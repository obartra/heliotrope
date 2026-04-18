import { describe, it, expect } from 'vitest';
import { TimestampSchema } from './timestamp.js';

describe('TimestampSchema', () => {
  it('accepts a valid Firestore Timestamp-like object', () => {
    const ts = { seconds: 1700000000, nanoseconds: 123456789 };
    expect(TimestampSchema.parse(ts)).toEqual(ts);
  });

  it('accepts zero values', () => {
    const ts = { seconds: 0, nanoseconds: 0 };
    expect(TimestampSchema.parse(ts)).toEqual(ts);
  });

  it('accepts negative seconds (pre-epoch)', () => {
    const ts = { seconds: -1000, nanoseconds: 0 };
    expect(TimestampSchema.parse(ts)).toEqual(ts);
  });

  it('accepts objects with extra properties (passthrough)', () => {
    const ts = { seconds: 100, nanoseconds: 0, toDate: () => new Date() };
    expect(TimestampSchema.parse(ts)).toEqual(ts);
  });

  it('rejects null', () => {
    expect(() => TimestampSchema.parse(null)).toThrow();
  });

  it('rejects undefined', () => {
    expect(() => TimestampSchema.parse(undefined)).toThrow();
  });

  it('rejects a plain number', () => {
    expect(() => TimestampSchema.parse(12345)).toThrow();
  });

  it('rejects a string', () => {
    expect(() => TimestampSchema.parse('2024-01-01')).toThrow();
  });

  it('rejects an object missing seconds', () => {
    expect(() => TimestampSchema.parse({ nanoseconds: 0 })).toThrow();
  });

  it('rejects an object missing nanoseconds', () => {
    expect(() => TimestampSchema.parse({ seconds: 100 })).toThrow();
  });

  it('rejects seconds as string', () => {
    expect(() => TimestampSchema.parse({ seconds: '100', nanoseconds: 0 })).toThrow();
  });

  it('rejects nanoseconds as string', () => {
    expect(() => TimestampSchema.parse({ seconds: 100, nanoseconds: '0' })).toThrow();
  });

  it('rejects an empty object', () => {
    expect(() => TimestampSchema.parse({})).toThrow();
  });
});
