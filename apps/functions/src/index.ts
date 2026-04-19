import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import { type HttpsFunction, onRequest } from 'firebase-functions/v2/https';
import {
  beforeUserCreated as beforeUserCreatedTrigger,
  type AuthBlockingEvent,
} from 'firebase-functions/v2/identity';
import { onSchedule, type ScheduleFunction } from 'firebase-functions/v2/scheduler';
import { checkAllowlist } from './auth/beforeUserCreated.js';
import { handleGenerateIosShortcutBearer } from './http/generateIosShortcutBearer.js';
import { handleIngestLocation } from './http/ingestLocation.js';
import { handleSetSlackToken } from './http/setSlackToken.js';
import { handleSyncNow } from './http/syncNow.js';
import { handleTestRule } from './http/testRule.js';
import { handleSyncAvatar } from './scheduled/syncAvatar.js';

initializeApp();

const allowedSignupEmails = defineSecret('ALLOWED_SIGNUP_EMAILS');
const tokenEncryptionKey = defineSecret('TOKEN_ENCRYPTION_KEY');

export const beforeUserCreated: ReturnType<typeof beforeUserCreatedTrigger> =
  beforeUserCreatedTrigger({ secrets: [allowedSignupEmails] }, (event: AuthBlockingEvent) => {
    checkAllowlist(event.data?.email, allowedSignupEmails.value());
  });

export const ingestLocation: HttpsFunction = onRequest({ cors: true }, (req, res) =>
  handleIngestLocation(req, res),
);

export const syncNow: HttpsFunction = onRequest(
  { cors: true, secrets: [tokenEncryptionKey] },
  (req, res) => handleSyncNow(req, res, tokenEncryptionKey.value()),
);

export const testRule: HttpsFunction = onRequest({ cors: true }, (req, res) =>
  handleTestRule(req, res),
);

export const setSlackToken: HttpsFunction = onRequest(
  { cors: true, secrets: [tokenEncryptionKey] },
  (req, res) => handleSetSlackToken(req, res, tokenEncryptionKey.value()),
);

export const generateIosShortcutBearer: HttpsFunction = onRequest({ cors: true }, (req, res) =>
  handleGenerateIosShortcutBearer(req, res),
);

export const syncAvatar: ScheduleFunction = onSchedule(
  { schedule: 'every 15 minutes', secrets: [tokenEncryptionKey] },
  async () => {
    await handleSyncAvatar(tokenEncryptionKey.value());
  },
);
