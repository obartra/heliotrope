import { HttpsError } from 'firebase-functions/v2/https';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuthedUser } from './requireAuthedUser.js';

const mockVerifyIdToken = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}));

vi.mock('firebase-admin/app', () => ({
  getApp: () => ({}),
}));

function makeRequest(authorization: string): { headers: { authorization: string } };
function makeRequest(): { headers: Record<string, never> };
function makeRequest(authorization?: string) {
  if (authorization !== undefined) {
    return { headers: { authorization } };
  }
  return { headers: {} };
}

describe('requireAuthedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns uid and email for a valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-123',
      email: 'test@example.com',
    });

    const result = await requireAuthedUser(makeRequest('Bearer valid-token'));
    expect(result).toEqual({ uid: 'user-123', email: 'test@example.com' });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
  });

  it('throws when Authorization header is missing', async () => {
    await expect(requireAuthedUser(makeRequest())).rejects.toThrow(HttpsError);
    await expect(requireAuthedUser(makeRequest())).rejects.toThrow(
      'Missing or malformed Authorization header.',
    );
  });

  it('throws when Authorization header has no Bearer prefix', async () => {
    await expect(requireAuthedUser(makeRequest('Basic abc123'))).rejects.toThrow(HttpsError);
  });

  it('throws when token verification fails', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

    await expect(requireAuthedUser(makeRequest('Bearer bad-token'))).rejects.toThrow(
      'Invalid or expired token.',
    );
  });

  it('throws when decoded token has no email', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-123' });

    await expect(requireAuthedUser(makeRequest('Bearer no-email-token'))).rejects.toThrow(
      'Token does not contain an email.',
    );
  });
});
