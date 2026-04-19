import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const ImageVariantSchema = z.object({
  storagePath: z.string(),
  contentType: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
});

export type ImageVariant = z.infer<typeof ImageVariantSchema>;

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
  variants: z.record(z.string(), ImageVariantSchema).optional(),
});

export type Image = z.infer<typeof ImageSchema>;
