import { describe, expect, it } from 'vitest';
import { computeHash } from './hash';

describe('computeHash', () => {
  it('produces a 64-character hex string', () => {
    const hash = computeHash('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    expect(computeHash('hello')).toBe(computeHash('hello'));
  });

  it('different inputs produce different hashes', () => {
    expect(computeHash('a')).not.toBe(computeHash('b'));
  });

  it('works with Buffer input', () => {
    const buf = Buffer.from('test');
    const hash = computeHash(buf);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(computeHash('test'));
  });
});
