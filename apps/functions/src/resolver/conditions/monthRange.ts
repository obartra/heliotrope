import type { MonthRangeCondition } from '@heliotrope/schema';
import { getLocalDateTime } from '../localTime.js';
import type { ConditionMatcher } from '../types.js';

export const matchMonthRange: ConditionMatcher<MonthRangeCondition> = (
  condition,
  _signals,
  now,
  timezone,
) => {
  const { month } = getLocalDateTime(now, timezone);
  const { fromMonth, toMonth } = condition;

  let matched: boolean;
  if (fromMonth <= toMonth) {
    matched = month >= fromMonth && month <= toMonth;
  } else {
    matched = month >= fromMonth || month <= toMonth;
  }

  return {
    matched,
    detail: matched
      ? `month ${month} is within [${fromMonth}, ${toMonth}]`
      : `month ${month} is outside [${fromMonth}, ${toMonth}]`,
  };
};
