import type { NearCityCondition } from '@heliotrope/schema';
import { LOCATION_STALE_THRESHOLD_MINUTES } from '../constants.js';
import type { ConditionMatcher } from '../types.js';

export const matchNearCity: ConditionMatcher<NearCityCondition> = (condition, signals) => {
  if (signals.location === null) {
    return { matched: false, detail: 'no location available' };
  }
  if (signals.location.ageMinutes > LOCATION_STALE_THRESHOLD_MINUTES) {
    return { matched: false, detail: 'location stale' };
  }

  if (signals.nearbyCities.length === 0) {
    return { matched: false, detail: 'no nearby cities in signal data' };
  }

  const qualifying = signals.nearbyCities.find(
    (city) =>
      city.population >= condition.minPopulation && city.distanceKm <= condition.maxDistanceKm,
  );

  if (qualifying) {
    return {
      matched: true,
      detail: `"${qualifying.name}" (pop ${qualifying.population}, ${qualifying.distanceKm}km) qualifies`,
    };
  }

  return {
    matched: false,
    detail: `no city with population >= ${condition.minPopulation} within ${condition.maxDistanceKm}km`,
  };
};
