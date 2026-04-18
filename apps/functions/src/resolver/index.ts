import { evaluateCondition } from './conditions/index.js';
import type { ResolverInput, ResolverOutput, ResolverRule, TraceEntry } from './types.js';

export type {
  ResolverInput,
  ResolverOutput,
  ResolverOverride,
  ResolverRule,
  ResolverSignals,
  TraceEntry,
  MatchResult,
  ConditionMatcher,
} from './types.js';

export { LOCATION_STALE_THRESHOLD_MINUTES } from './constants.js';

function formatExpiry(expiresAt: Date | null): string {
  return expiresAt === null ? 'pinned' : expiresAt.toISOString();
}

export function resolveImage(input: ResolverInput): ResolverOutput {
  const { now, override, rules, defaultImageId } = input;
  const timezone = input.timezone ?? 'UTC';

  // Step 1: Active override
  if (override !== null) {
    const isActive = override.expiresAt === null || override.expiresAt > now;
    if (isActive) {
      return {
        chosenImageId: override.imageId,
        reason: `override (source: ${override.source}, expires: ${formatExpiry(override.expiresAt)})`,
        trace: [],
      };
    }
  }

  // Step 2: Rules (enabled only, sorted by priority desc, then updatedAt desc)
  const enabledRules = rules.filter((r) => r.enabled);
  const sorted = [...enabledRules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const trace: TraceEntry[] = [];

  for (const rule of sorted) {
    const result = evaluateRule(rule, input, timezone);
    trace.push(result.entry);

    if (result.entry.matched) {
      return {
        chosenImageId: rule.imageId,
        reason: `rule: ${rule.name} (id: ${rule.id}, priority: ${rule.priority})`,
        trace,
      };
    }
  }

  // Step 3: Default image
  if (defaultImageId !== null) {
    return {
      chosenImageId: defaultImageId,
      reason: 'default image',
      trace,
    };
  }

  // Step 4: No image
  return {
    chosenImageId: '',
    reason: 'no image selected',
    trace,
  };
}

function evaluateRule(
  rule: ResolverRule,
  input: ResolverInput,
  timezone: string,
): { entry: TraceEntry } {
  if (rule.conditions.length === 0) {
    return {
      entry: { ruleId: rule.id, ruleName: rule.name, matched: true },
    };
  }

  for (const condition of rule.conditions) {
    const result = evaluateCondition(condition, input.signals, input.now, timezone);
    if (!result.matched) {
      return {
        entry: {
          ruleId: rule.id,
          ruleName: rule.name,
          matched: false,
          failedCondition: { type: condition.type, detail: result.detail },
        },
      };
    }
  }

  return {
    entry: { ruleId: rule.id, ruleName: rule.name, matched: true },
  };
}
