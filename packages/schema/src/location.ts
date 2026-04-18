import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable(),
  timestamp: TimestampSchema,
  source: z.enum(['ios-shortcut', 'browser']),
});

export type Location = z.infer<typeof LocationSchema>;
