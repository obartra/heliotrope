import { type Condition, type Rule, RuleSchema } from '@heliotrope/schema';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { evaluateCondition } from '../resolver/conditions/index.js';
import type { ResolverSignals } from '../resolver/types.js';
import { assembleSignals } from '../signals/assembleSignals.js';
import { requireAuthedUser } from './requireAuthedUser.js';

const TestRuleByIdSchema = z.object({ ruleId: z.string() });
const TestRuleInlineSchema = z.object({ rule: RuleSchema });
const TestRuleBodySchema = z.union([TestRuleByIdSchema, TestRuleInlineSchema]);

export async function handleTestRule(
  req: { method: string; headers: { authorization?: string | undefined }; body: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<void> {
  if (req.method !== 'POST') {
    throw new HttpsError('invalid-argument', 'POST only.');
  }

  const { uid } = await requireAuthedUser(req);
  const now = new Date();
  const db = getFirestore();

  const parsed = TestRuleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid body: ${parsed.error.message}`);
  }

  let conditions: Condition[];
  let ruleName: string;

  if ('ruleId' in parsed.data) {
    const ruleDoc = await db.doc(`users/${uid}/rules/${parsed.data.ruleId}`).get();
    if (!ruleDoc.exists) {
      throw new HttpsError('not-found', 'Rule not found.');
    }
    const ruleData = ruleDoc.data() as Rule;
    conditions = ruleData.conditions;
    ruleName = ruleData.name;
  } else {
    conditions = parsed.data.rule.conditions;
    ruleName = parsed.data.rule.name;
  }

  const profileSnap = await db.doc(`users/${uid}/profile/singleton`).get();
  const profileData = profileSnap.exists
    ? (profileSnap.data() as { scheduler?: { timezone?: string } })
    : undefined;
  const timezone = profileData?.scheduler?.timezone ?? 'UTC';

  const signals: ResolverSignals = await assembleSignals(uid, now);

  const results = conditions.map((condition) => {
    const result = evaluateCondition(condition, signals, now, timezone);
    return {
      type: condition.type,
      matched: result.matched,
      explanation: result.detail,
    };
  });

  res.status(200).json({
    ruleName,
    conditionCount: conditions.length,
    allMatched: results.every((r) => r.matched),
    conditions: results,
    signals: {
      location: signals.location,
      weather: signals.weather,
      country: signals.country,
      nearbyCities: signals.nearbyCities,
      sunrise: signals.sunrise.toISOString(),
      sunset: signals.sunset.toISOString(),
    },
  });
}
