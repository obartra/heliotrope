import type { TimeOfDayCondition } from '@heliotrope/schema';
import type { ConditionMatcher } from '../types.js';

export const matchTimeOfDay: ConditionMatcher<TimeOfDayCondition> = (condition, signals, now) => {
  const isDay = now >= signals.sunrise && now < signals.sunset;
  const actual = isDay ? 'day' : 'night';
  const matched = condition.value === actual;

  return {
    matched,
    detail: matched
      ? `it is ${actual}, matches "${condition.value}"`
      : `it is ${actual}, does not match "${condition.value}"`,
  };
};
