import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const ImageSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  displayName: z.string(),
  storagePath: z.string(),
  contentType: z.string(),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tags: z.array(z.string()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Image = z.infer<typeof ImageSchema>;
