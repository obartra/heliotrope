import type { CountryCondition } from '@heliotrope/schema';
import { LOCATION_STALE_THRESHOLD_MINUTES } from '../constants.js';
import type { ConditionMatcher } from '../types.js';

export const matchCountry: ConditionMatcher<CountryCondition> = (condition, signals) => {
  if (signals.location === null) {
    return { matched: false, detail: 'no location available' };
  }
  if (signals.location.ageMinutes > LOCATION_STALE_THRESHOLD_MINUTES) {
    return { matched: false, detail: 'location stale' };
  }
  if (signals.country === null) {
    return { matched: false, detail: 'no country data available' };
  }

  const upper = signals.country.toUpperCase();
  const matched = condition.codes.some((code) => code.toUpperCase() === upper);

  return {
    matched,
    detail: matched
      ? `country "${signals.country}" matches [${condition.codes.join(', ')}]`
      : `country "${signals.country}" does not match [${condition.codes.join(', ')}]`,
  };
};
