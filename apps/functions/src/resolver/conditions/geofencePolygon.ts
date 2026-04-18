import type { GeofencePolygonCondition } from '@heliotrope/schema';
import { LOCATION_STALE_THRESHOLD_MINUTES } from '../constants.js';
import type { ConditionMatcher } from '../types.js';

function pointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]!;
    const [yj, xj] = polygon[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export const matchGeofencePolygon: ConditionMatcher<GeofencePolygonCondition> = (
  condition,
  signals,
) => {
  if (signals.location === null) {
    return { matched: false, detail: 'no location available' };
  }
  if (signals.location.ageMinutes > LOCATION_STALE_THRESHOLD_MINUTES) {
    return { matched: false, detail: 'location stale' };
  }

  const matched = pointInPolygon(signals.location.lat, signals.location.lon, condition.points);

  return {
    matched,
    detail: matched
      ? `point (${signals.location.lat}, ${signals.location.lon}) is inside polygon`
      : `point (${signals.location.lat}, ${signals.location.lon}) is outside polygon`,
  };
};
