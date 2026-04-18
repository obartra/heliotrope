import type { DayOfWeekCondition } from '@heliotrope/schema';
import { getLocalDateTime } from '../localTime.js';
import type { ConditionMatcher } from '../types.js';

export const matchDayOfWeek: ConditionMatcher<DayOfWeekCondition> = (
  condition,
  _signals,
  now,
  timezone,
) => {
  const { dayOfWeek } = getLocalDateTime(now, timezone);
  const matched = condition.days.includes(dayOfWeek);

  return {
    matched,
    detail: matched
      ? `day ${dayOfWeek} is in [${condition.days.join(', ')}]`
      : `day ${dayOfWeek} is not in [${condition.days.join(', ')}]`,
  };
};
