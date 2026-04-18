import type { Condition } from '@heliotrope/schema';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const CONDITION_LABELS: Record<Condition['type'], string> = {
  date: 'Date',
  dateRange: 'Date Range',
  monthRange: 'Month Range',
  dayOfWeek: 'Day of Week',
  timeRange: 'Time Range',
  timeOfDay: 'Time of Day',
  geofenceCircle: 'Geofence (Circle)',
  geofencePolygon: 'Geofence (Polygon)',
  country: 'Country',
  weather: 'Weather',
  nearCity: 'Near City',
};

export function getConditionLabel(type: Condition['type']): string {
  return CONDITION_LABELS[type];
}

export function getConditionSummary(condition: Condition): string {
  switch (condition.type) {
    case 'date': {
      const [mm, dd] = condition.monthDay.split('-');
      const monthIdx = parseInt(mm ?? '0', 10) - 1;
      const monthName = MONTH_NAMES[monthIdx] ?? mm;
      const before = condition.windowDaysBefore ?? 0;
      const after = condition.windowDaysAfter ?? 0;
      if (before === 0 && after === 0) return `${monthName} ${dd}`;
      return `${monthName} ${dd}, -${String(before)}/+${String(after)} days`;
    }
    case 'dateRange':
      return `${condition.fromISO} to ${condition.toISO}`;
    case 'monthRange': {
      const from = MONTH_NAMES[condition.fromMonth - 1] ?? String(condition.fromMonth);
      const to = MONTH_NAMES[condition.toMonth - 1] ?? String(condition.toMonth);
      return `${from} to ${to}`;
    }
    case 'dayOfWeek':
      return condition.days.map((d) => DAY_NAMES[d - 1] ?? String(d)).join(', ');
    case 'timeRange':
      return `${condition.fromLocal} to ${condition.toLocal}`;
    case 'timeOfDay':
      return condition.value === 'day' ? 'Day' : 'Night';
    case 'geofenceCircle':
      return `Circle at [${condition.center[0].toFixed(2)}, ${condition.center[1].toFixed(2)}], radius ${String(condition.radiusMeters)} m`;
    case 'geofencePolygon':
      return `Polygon with ${String(condition.points.length)} vertices`;
    case 'country':
      return condition.codes.join(', ');
    case 'weather':
      return `${condition.field} ${condition.op} ${String(condition.value)}`;
    case 'nearCity':
      return `Pop >= ${condition.minPopulation.toLocaleString()} within ${String(condition.maxDistanceKm)} km`;
  }
}

export function createDefaultCondition(type: Condition['type']): Condition {
  switch (type) {
    case 'date':
      return { type: 'date', monthDay: '01-01' };
    case 'dateRange':
      return { type: 'dateRange', fromISO: '2026-01-01', toISO: '2026-12-31' };
    case 'monthRange':
      return { type: 'monthRange', fromMonth: 1, toMonth: 12 };
    case 'dayOfWeek':
      return { type: 'dayOfWeek', days: [1, 2, 3, 4, 5] };
    case 'timeRange':
      return { type: 'timeRange', fromLocal: '09:00', toLocal: '17:00' };
    case 'timeOfDay':
      return { type: 'timeOfDay', value: 'day' };
    case 'geofenceCircle':
      return { type: 'geofenceCircle', center: [0, 0], radiusMeters: 500 };
    case 'geofencePolygon':
      return { type: 'geofencePolygon', points: [] };
    case 'country':
      // @ts-expect-error default starts empty, validated before save
      return { type: 'country', codes: [] };
    case 'weather':
      return { type: 'weather', field: 'temperatureC', op: '>=', value: 0 };
    case 'nearCity':
      return { type: 'nearCity', minPopulation: 100000, maxDistanceKm: 10 };
  }
}
