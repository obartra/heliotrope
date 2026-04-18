import { z } from 'zod';
import { ConditionSchema } from './condition.js';
import { TimestampSchema } from './timestamp.js';

export const RuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
  priority: z.number().int(),
  imageId: z.string().uuid(),
  conditions: z.array(ConditionSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Rule = z.infer<typeof RuleSchema>;
