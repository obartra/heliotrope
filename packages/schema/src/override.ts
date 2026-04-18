import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const OverrideSchema = z.object({
  imageId: z.string().uuid(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema.nullable(),
  source: z.enum(['ui', 'ios-shortcut']),
});

export type Override = z.infer<typeof OverrideSchema>;
