import type { DateCondition } from '@heliotrope/schema';
import { getLocalDateTime } from '../localTime.js';
import type { ConditionMatcher } from '../types.js';

export const matchDate: ConditionMatcher<DateCondition> = (condition, _signals, now, timezone) => {
  const local = getLocalDateTime(now, timezone);
  const targetMonth = parseInt(condition.monthDay.slice(0, 2), 10);
  const targetDay = parseInt(condition.monthDay.slice(3, 5), 10);
  const before = condition.windowDaysBefore ?? 0;
  const after = condition.windowDaysAfter ?? 0;

  if (before === 0 && after === 0) {
    const matched = local.month === targetMonth && local.day === targetDay;
    return {
      matched,
      detail: matched
        ? `${pad(local.month)}-${pad(local.day)} matches ${condition.monthDay}`
        : `${pad(local.month)}-${pad(local.day)} does not match ${condition.monthDay}`,
    };
  }

  const targetDate = new Date(local.year, targetMonth - 1, targetDay);
  const windowStart = new Date(targetDate);
  windowStart.setDate(windowStart.getDate() - before);
  const windowEnd = new Date(targetDate);
  windowEnd.setDate(windowEnd.getDate() + after);

  const localDate = new Date(local.year, local.month - 1, local.day);

  let matched = localDate >= windowStart && localDate <= windowEnd;

  if (!matched) {
    const prevYearTarget = new Date(local.year - 1, targetMonth - 1, targetDay);
    const prevStart = new Date(prevYearTarget);
    prevStart.setDate(prevStart.getDate() - before);
    const prevEnd = new Date(prevYearTarget);
    prevEnd.setDate(prevEnd.getDate() + after);
    if (localDate >= prevStart && localDate <= prevEnd) matched = true;
  }

  if (!matched) {
    const nextYearTarget = new Date(local.year + 1, targetMonth - 1, targetDay);
    const nextStart = new Date(nextYearTarget);
    nextStart.setDate(nextStart.getDate() - before);
    const nextEnd = new Date(nextYearTarget);
    nextEnd.setDate(nextEnd.getDate() + after);
    if (localDate >= nextStart && localDate <= nextEnd) matched = true;
  }

  const startStr = `${pad(windowStart.getMonth() + 1)}-${pad(windowStart.getDate())}`;
  const endStr = `${pad(windowEnd.getMonth() + 1)}-${pad(windowEnd.getDate())}`;
  return {
    matched,
    detail: matched
      ? `${pad(local.month)}-${pad(local.day)} is within window [${startStr}, ${endStr}]`
      : `${pad(local.month)}-${pad(local.day)} is outside window [${startStr}, ${endStr}]`,
  };
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
