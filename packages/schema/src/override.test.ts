import { describe, it, expect } from 'vitest';
import { OverrideSchema } from './override.js';

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

const ts = { seconds: 1700000000, nanoseconds: 0 };

const validOverride = {
  imageId: '550e8400-e29b-41d4-a716-446655440000',
  createdAt: ts,
  expiresAt: { seconds: 1700100000, nanoseconds: 0 },
  source: 'ui' as const,
};

describe('OverrideSchema', () => {
  it('parses a valid override with expiration', () => {
    expect(OverrideSchema.parse(validOverride)).toEqual(validOverride);
  });

  it('accepts null expiresAt (pinned indefinitely)', () => {
    expect(OverrideSchema.parse({ ...validOverride, expiresAt: null })).toBeTruthy();
  });

  it('accepts ios-shortcut source', () => {
    expect(OverrideSchema.parse({ ...validOverride, source: 'ios-shortcut' })).toBeTruthy();
  });

  it('rejects invalid source', () => {
    expect(() => OverrideSchema.parse({ ...validOverride, source: 'api' })).toThrow();
  });

  it('rejects invalid UUID for imageId', () => {
    expect(() => OverrideSchema.parse({ ...validOverride, imageId: 'not-uuid' })).toThrow();
  });

  it('rejects missing imageId', () => {
    expect(() => OverrideSchema.parse(omit(validOverride, 'imageId'))).toThrow();
  });

  it('rejects missing createdAt', () => {
    expect(() => OverrideSchema.parse(omit(validOverride, 'createdAt'))).toThrow();
  });

  it('rejects missing source', () => {
    expect(() => OverrideSchema.parse(omit(validOverride, 'source'))).toThrow();
  });

  it('rejects invalid expiresAt (not a timestamp and not null)', () => {
    expect(() => OverrideSchema.parse({ ...validOverride, expiresAt: 'tomorrow' })).toThrow();
  });
});
