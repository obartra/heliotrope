import { randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './encrypt';

const testKey = randomBytes(32).toString('base64');

describe('encryptToken / decryptToken', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'xoxp-test-token-12345';
    const cipher = encryptToken(plaintext, testKey);
    const decrypted = decryptToken(cipher, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each time (unique IV)', () => {
    const plaintext = 'same-input';
    const cipher1 = encryptToken(plaintext, testKey);
    const cipher2 = encryptToken(plaintext, testKey);
    expect(cipher1).not.toBe(cipher2);
    expect(decryptToken(cipher1, testKey)).toBe(plaintext);
    expect(decryptToken(cipher2, testKey)).toBe(plaintext);
  });

  it('throws on wrong key', () => {
    const plaintext = 'secret';
    const cipher = encryptToken(plaintext, testKey);
    const wrongKey = randomBytes(32).toString('base64');
    expect(() => decryptToken(cipher, wrongKey)).toThrow();
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encryptToken('data', testKey);
    const buf = Buffer.from(cipher, 'base64');
    const lastIdx = buf.length - 1;
    buf.writeUInt8((buf.readUInt8(lastIdx) ^ 0xff) & 0xff, lastIdx);
    const tampered = buf.toString('base64');
    expect(() => decryptToken(tampered, testKey)).toThrow();
  });
});
