import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import {
  beforeUserCreated as beforeUserCreatedTrigger,
  type AuthBlockingEvent,
} from 'firebase-functions/v2/identity';
import { checkAllowlist } from './auth/beforeUserCreated.js';

initializeApp();

const allowedSignupEmails = defineSecret('ALLOWED_SIGNUP_EMAILS');

export const beforeUserCreated: ReturnType<typeof beforeUserCreatedTrigger> =
  beforeUserCreatedTrigger({ secrets: [allowedSignupEmails] }, (event: AuthBlockingEvent) => {
    checkAllowlist(event.data?.email, allowedSignupEmails.value());
  });
