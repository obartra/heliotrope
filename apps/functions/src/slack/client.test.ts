import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateToken } from './client';

describe('validateToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success with user and team info', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, user_id: 'U123', team_id: 'T456', team: 'Acme Corp' }),
      ),
    );

    const result = await validateToken('xoxp-test');
    expect(result).toEqual({
      ok: true,
      userId: 'U123',
      teamId: 'T456',
      teamName: 'Acme Corp',
    });
  });

  it('returns failure for invalid token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'invalid_auth' })),
    );

    const result = await validateToken('bad-token');
    expect(result).toEqual({ ok: false, error: 'invalid_auth' });
  });

  it('returns failure on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));

    const result = await validateToken('xoxp-test');
    expect(result).toEqual({ ok: false, error: 'network_error' });
  });

  it('returns teamName as null when not provided by Slack', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, user_id: 'U123', team_id: 'T456' })),
    );

    const result = await validateToken('xoxp-test');
    expect(result).toEqual({
      ok: true,
      userId: 'U123',
      teamId: 'T456',
      teamName: null,
    });
  });

  it('returns failure for unexpected response shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('not json', { status: 500 }));

    const result = await validateToken('xoxp-test');
    expect(result.ok).toBe(false);
  });
});
