import { auth } from './firebase';

const FUNCTIONS_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/demo-heliotrope/us-central1'
  : ((import.meta.env.VITE_FUNCTIONS_BASE as string | undefined) ?? '');

/**
 * Call a Cloud Function endpoint with the current user's ID token.
 * Returns the parsed JSON response body.
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();

  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T;
  return data;
}
