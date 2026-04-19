import { Blob } from 'buffer';
import { z } from 'zod';

const SlackAuthTestResponseSchema = z.object({
  ok: z.boolean(),
  user_id: z.string().optional(),
  team_id: z.string().optional(),
  team: z.string().optional(),
  error: z.string().optional(),
});

export interface SlackValidateSuccess {
  ok: true;
  userId: string;
  teamId: string;
  teamName: string | null;
}

export interface SlackValidateFailure {
  ok: false;
  error: string;
}

export type SlackValidateResult = SlackValidateSuccess | SlackValidateFailure;

export async function validateToken(token: string): Promise<SlackValidateResult> {
  let response: Response;
  try {
    response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: 'unexpected_response' };
  }

  const parsed = SlackAuthTestResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: 'unexpected_response' };
  }

  const data = parsed.data;
  if (!data.ok) {
    return { ok: false, error: data.error ?? 'unknown_error' };
  }

  if (!data.user_id || !data.team_id) {
    return { ok: false, error: 'missing_ids' };
  }

  return {
    ok: true,
    userId: data.user_id,
    teamId: data.team_id,
    teamName: data.team ?? null,
  };
}

export interface UploadAvatarSuccess {
  ok: true;
}

export interface UploadAvatarFailure {
  ok: false;
  error: string;
  retryAfterSeconds?: number;
}

export type UploadAvatarResult = UploadAvatarSuccess | UploadAvatarFailure;

const SlackSetPhotoResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export async function uploadAvatar(
  token: string,
  imageBytes: Buffer,
  contentType: string,
): Promise<UploadAvatarResult> {
  const formData = new FormData();
  formData.append('image', new Blob([imageBytes], { type: contentType }), 'avatar.png');

  let response: Response;
  try {
    response = await fetch('https://slack.com/api/users.setPhoto', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const result: UploadAvatarFailure = { ok: false, error: 'rate_limited' };
    if (retryAfter) {
      result.retryAfterSeconds = parseInt(retryAfter, 10);
    }
    return result;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: 'unexpected_response' };
  }

  const parsed = SlackSetPhotoResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: 'unexpected_response' };
  }

  if (!parsed.data.ok) {
    return { ok: false, error: parsed.data.error ?? 'unknown_error' };
  }

  return { ok: true };
}
