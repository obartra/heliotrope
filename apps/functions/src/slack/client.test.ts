import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadAvatar, validateToken } from './client';

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

describe('uploadAvatar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fakeImage = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  it('returns success on ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const result = await uploadAvatar('xoxp-test', fakeImage, 'image/png');
    expect(result).toEqual({ ok: true });
  });

  it('returns error on Slack API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'invalid_auth' })),
    );

    const result = await uploadAvatar('xoxp-test', fakeImage, 'image/png');
    expect(result).toEqual({ ok: false, error: 'invalid_auth' });
  });

  it('returns rate_limited with retryAfterSeconds on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', { status: 429, headers: { 'Retry-After': '30' } }),
    );

    const result = await uploadAvatar('xoxp-test', fakeImage, 'image/png');
    expect(result).toEqual({ ok: false, error: 'rate_limited', retryAfterSeconds: 30 });
  });

  it('returns network_error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));

    const result = await uploadAvatar('xoxp-test', fakeImage, 'image/png');
    expect(result).toEqual({ ok: false, error: 'network_error' });
  });

  it('sends image as multipart form data with correct auth header', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await uploadAvatar('xoxp-my-token', fakeImage, 'image/png');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/users.setPhoto');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer xoxp-my-token');
    expect(init.body).toBeInstanceOf(FormData);
  });
});
