import type { Condition } from '@heliotrope/schema';
import type { MatchResult, ResolverSignals } from '../types.js';
import { matchCountry } from './country.js';
import { matchDate } from './date.js';
import { matchDateRange } from './dateRange.js';
import { matchDayOfWeek } from './dayOfWeek.js';
import { matchGeofenceCircle } from './geofenceCircle.js';
import { matchGeofencePolygon } from './geofencePolygon.js';
import { matchMonthRange } from './monthRange.js';
import { matchNearCity } from './nearCity.js';
import { matchTimeOfDay } from './timeOfDay.js';
import { matchTimeRange } from './timeRange.js';
import { matchWeather } from './weather.js';

export function evaluateCondition(
  condition: Condition,
  signals: ResolverSignals,
  now: Date,
  timezone: string,
): MatchResult {
  switch (condition.type) {
    case 'date':
      return matchDate(condition, signals, now, timezone);
    case 'dateRange':
      return matchDateRange(condition, signals, now, timezone);
    case 'monthRange':
      return matchMonthRange(condition, signals, now, timezone);
    case 'dayOfWeek':
      return matchDayOfWeek(condition, signals, now, timezone);
    case 'timeRange':
      return matchTimeRange(condition, signals, now, timezone);
    case 'timeOfDay':
      return matchTimeOfDay(condition, signals, now, timezone);
    case 'geofenceCircle':
      return matchGeofenceCircle(condition, signals, now, timezone);
    case 'geofencePolygon':
      return matchGeofencePolygon(condition, signals, now, timezone);
    case 'country':
      return matchCountry(condition, signals, now, timezone);
    case 'weather':
      return matchWeather(condition, signals, now, timezone);
    case 'nearCity':
      return matchNearCity(condition, signals, now, timezone);
  }
}
