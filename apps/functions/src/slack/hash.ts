import { createHash } from 'crypto';

/** Compute a SHA-256 hex digest of the given input. */
export function computeHash(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}
