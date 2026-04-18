import type { GeofenceCircleCondition } from '@heliotrope/schema';
import { LOCATION_STALE_THRESHOLD_MINUTES } from '../constants.js';
import type { ConditionMatcher } from '../types.js';

const EARTH_RADIUS_METERS = 6_371_000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export const matchGeofenceCircle: ConditionMatcher<GeofenceCircleCondition> = (
  condition,
  signals,
) => {
  if (signals.location === null) {
    return { matched: false, detail: 'no location available' };
  }
  if (signals.location.ageMinutes > LOCATION_STALE_THRESHOLD_MINUTES) {
    return { matched: false, detail: 'location stale' };
  }

  const [centerLat, centerLon] = condition.center;
  const dist = haversineMeters(signals.location.lat, signals.location.lon, centerLat, centerLon);
  const matched = dist <= condition.radiusMeters;

  return {
    matched,
    detail: matched
      ? `${Math.round(dist)}m from center, within ${condition.radiusMeters}m radius`
      : `${Math.round(dist)}m from center, outside ${condition.radiusMeters}m radius`,
  };
};
