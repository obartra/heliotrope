import { HttpsError } from 'firebase-functions/v2/https';
import { evaluateAndUpload } from '../scheduled/evaluateAndUpload.js';
import { requireAuthedUser } from './requireAuthedUser.js';

export async function handleSyncNow(
  req: { method: string; headers: { authorization?: string | undefined }; body: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  encryptionKey: string,
): Promise<void> {
  if (req.method !== 'POST') {
    throw new HttpsError('invalid-argument', 'POST only.');
  }

  const { uid } = await requireAuthedUser(req);
  const result = await evaluateAndUpload(uid, encryptionKey);

  res.status(200).json(result);
}
