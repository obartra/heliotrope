import type { TimeRangeCondition } from '@heliotrope/schema';
import { getLocalDateTime } from '../localTime.js';
import type { ConditionMatcher } from '../types.js';

export const matchTimeRange: ConditionMatcher<TimeRangeCondition> = (
  condition,
  _signals,
  now,
  timezone,
) => {
  const local = getLocalDateTime(now, timezone);
  const current = `${pad(local.hour)}:${pad(local.minute)}`;
  const { fromLocal, toLocal } = condition;

  let matched: boolean;
  if (fromLocal <= toLocal) {
    matched = current >= fromLocal && current < toLocal;
  } else {
    matched = current >= fromLocal || current < toLocal;
  }

  return {
    matched,
    detail: matched
      ? `${current} is within [${fromLocal}, ${toLocal})`
      : `${current} is outside [${fromLocal}, ${toLocal})`,
  };
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
