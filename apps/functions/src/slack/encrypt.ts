import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64 string of IV (12 bytes) || ciphertext || auth tag (16 bytes).
 */
export function encryptToken(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * Decrypt a token previously encrypted with encryptToken.
 * Input is the base64 string of IV || ciphertext || auth tag.
 */
export function decryptToken(tokenCipher: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const data = Buffer.from(tokenCipher, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
