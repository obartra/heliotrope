import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const SlackConnectionSchema = z.object({
  connected: z.boolean(),
  teamId: z.string().nullable(),
  userId: z.string().nullable(),
  teamName: z.string().nullable(),
  lastValidatedAt: TimestampSchema.nullable(),
});

export const SchedulerSchema = z.object({
  intervalMinutes: z.number().int().min(5).max(1440),
  minSecondsBetweenSlackUploads: z.number().int().min(60).max(86400),
});

export const IosShortcutBearerInfoSchema = z.object({
  createdAt: TimestampSchema,
  lastUsedAt: TimestampSchema.nullable(),
});

export const ProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  slack: SlackConnectionSchema,
  scheduler: SchedulerSchema,
  defaultImageId: z.string().uuid().nullable(),
  iosShortcutBearer: IosShortcutBearerInfoSchema.nullable(),
  createdAt: TimestampSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type SlackConnection = z.infer<typeof SlackConnectionSchema>;
export type Scheduler = z.infer<typeof SchedulerSchema>;
export type IosShortcutBearerInfo = z.infer<typeof IosShortcutBearerInfoSchema>;
