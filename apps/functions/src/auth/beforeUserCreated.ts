import { HttpsError } from 'firebase-functions/v2/identity';
import { z } from 'zod';

const AllowlistSchema = z.array(z.string().email());

export function checkAllowlist(email: string | undefined, allowlistJson: string): void {
  if (!email) {
    throw new HttpsError('permission-denied', 'Email is required to sign up.');
  }

  let allowlist: string[];
  try {
    allowlist = AllowlistSchema.parse(JSON.parse(allowlistJson));
  } catch {
    throw new HttpsError(
      'internal',
      'Allowlist configuration is invalid. Contact the administrator.',
    );
  }

  const normalizedEmail = email.toLowerCase();
  const allowed = allowlist.some((e) => e.toLowerCase() === normalizedEmail);

  if (!allowed) {
    throw new HttpsError('permission-denied', 'This email is not allowed to sign up.');
  }
}
