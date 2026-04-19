import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import { type HttpsFunction, onRequest } from 'firebase-functions/v2/https';
import {
  beforeUserCreated as beforeUserCreatedTrigger,
  type AuthBlockingEvent,
} from 'firebase-functions/v2/identity';
import { checkAllowlist } from './auth/beforeUserCreated.js';
import { handleIngestLocation } from './http/ingestLocation.js';
import { handleSyncNow } from './http/syncNow.js';
import { handleTestRule } from './http/testRule.js';

initializeApp();

const allowedSignupEmails = defineSecret('ALLOWED_SIGNUP_EMAILS');

export const beforeUserCreated: ReturnType<typeof beforeUserCreatedTrigger> =
  beforeUserCreatedTrigger({ secrets: [allowedSignupEmails] }, (event: AuthBlockingEvent) => {
    checkAllowlist(event.data?.email, allowedSignupEmails.value());
  });

export const ingestLocation: HttpsFunction = onRequest({ cors: true }, (req, res) =>
  handleIngestLocation(req, res),
);

export const syncNow: HttpsFunction = onRequest({ cors: true }, (req, res) =>
  handleSyncNow(req, res),
);

export const testRule: HttpsFunction = onRequest({ cors: true }, (req, res) =>
  handleTestRule(req, res),
);
