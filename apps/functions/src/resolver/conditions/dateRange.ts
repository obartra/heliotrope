import type { DateRangeCondition } from '@heliotrope/schema';
import { getLocalDateTime } from '../localTime.js';
import type { ConditionMatcher } from '../types.js';

export const matchDateRange: ConditionMatcher<DateRangeCondition> = (
  condition,
  _signals,
  now,
  timezone,
) => {
  const local = getLocalDateTime(now, timezone);
  const localISO = `${local.year}-${pad(local.month)}-${pad(local.day)}`;

  const matched = localISO >= condition.fromISO && localISO <= condition.toISO;

  return {
    matched,
    detail: matched
      ? `${localISO} is within [${condition.fromISO}, ${condition.toISO}]`
      : `${localISO} is outside [${condition.fromISO}, ${condition.toISO}]`,
  };
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
