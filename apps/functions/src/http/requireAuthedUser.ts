import { getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError } from 'firebase-functions/v2/https';

export async function requireAuthedUser(req: {
  headers: { authorization?: string };
}): Promise<{ uid: string; email: string }> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Missing or malformed Authorization header.');
  }

  const token = header.slice('Bearer '.length);

  let decoded;
  try {
    decoded = await getAuth(getApp()).verifyIdToken(token);
  } catch {
    throw new HttpsError('unauthenticated', 'Invalid or expired token.');
  }

  const { uid, email } = decoded;
  if (!email) {
    throw new HttpsError('unauthenticated', 'Token does not contain an email.');
  }

  return { uid, email };
}
