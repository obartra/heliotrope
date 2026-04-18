import { describe, it, expect } from 'vitest';
import {
  ConditionSchema,
  DateConditionSchema,
  DateRangeConditionSchema,
  MonthRangeConditionSchema,
  DayOfWeekConditionSchema,
  TimeRangeConditionSchema,
  TimeOfDayConditionSchema,
  GeofenceCircleConditionSchema,
  GeofencePolygonConditionSchema,
  CountryConditionSchema,
  WeatherConditionSchema,
  NearCityConditionSchema,
} from './condition.js';

// ---- date ----

describe('DateConditionSchema', () => {
  it('parses a valid date condition', () => {
    const input = { type: 'date' as const, monthDay: '01-01' };
    expect(DateConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts optional window fields', () => {
    const input = {
      type: 'date' as const,
      monthDay: '12-25',
      windowDaysBefore: 3,
      windowDaysAfter: 1,
    };
    expect(DateConditionSchema.parse(input)).toEqual(input);
  });

  it('allows omitting window fields', () => {
    const result = DateConditionSchema.parse({ type: 'date', monthDay: '06-15' });
    expect(result.windowDaysBefore).toBeUndefined();
    expect(result.windowDaysAfter).toBeUndefined();
  });

  it('rejects missing monthDay', () => {
    expect(() => DateConditionSchema.parse({ type: 'date' })).toThrow();
  });

  it('rejects invalid monthDay format', () => {
    expect(() => DateConditionSchema.parse({ type: 'date', monthDay: '1-1' })).toThrow();
    expect(() => DateConditionSchema.parse({ type: 'date', monthDay: '2024-01-01' })).toThrow();
  });

  it('rejects negative window values', () => {
    expect(() =>
      DateConditionSchema.parse({ type: 'date', monthDay: '01-01', windowDaysBefore: -1 }),
    ).toThrow();
  });

  it('rejects non-integer window values', () => {
    expect(() =>
      DateConditionSchema.parse({ type: 'date', monthDay: '01-01', windowDaysAfter: 1.5 }),
    ).toThrow();
  });
});

// ---- dateRange ----

describe('DateRangeConditionSchema', () => {
  it('parses a valid date range', () => {
    const input = { type: 'dateRange' as const, fromISO: '2024-01-01', toISO: '2024-12-31' };
    expect(DateRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('allows same-day range', () => {
    const input = { type: 'dateRange' as const, fromISO: '2024-06-15', toISO: '2024-06-15' };
    expect(DateRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects missing fromISO', () => {
    expect(() =>
      DateRangeConditionSchema.parse({ type: 'dateRange', toISO: '2024-12-31' }),
    ).toThrow();
  });

  it('rejects missing toISO', () => {
    expect(() =>
      DateRangeConditionSchema.parse({ type: 'dateRange', fromISO: '2024-01-01' }),
    ).toThrow();
  });

  it('rejects invalid ISO date format', () => {
    expect(() =>
      DateRangeConditionSchema.parse({
        type: 'dateRange',
        fromISO: '01-01-2024',
        toISO: '2024-12-31',
      }),
    ).toThrow();
  });
});

// ---- monthRange ----

describe('MonthRangeConditionSchema', () => {
  it('parses a valid month range', () => {
    const input = { type: 'monthRange' as const, fromMonth: 1, toMonth: 12 };
    expect(MonthRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts wrapping range (Nov to Feb)', () => {
    const input = { type: 'monthRange' as const, fromMonth: 11, toMonth: 2 };
    expect(MonthRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts same-month range', () => {
    const input = { type: 'monthRange' as const, fromMonth: 6, toMonth: 6 };
    expect(MonthRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects month below 1', () => {
    expect(() =>
      MonthRangeConditionSchema.parse({ type: 'monthRange', fromMonth: 0, toMonth: 12 }),
    ).toThrow();
  });

  it('rejects month above 12', () => {
    expect(() =>
      MonthRangeConditionSchema.parse({ type: 'monthRange', fromMonth: 1, toMonth: 13 }),
    ).toThrow();
  });

  it('rejects non-integer months', () => {
    expect(() =>
      MonthRangeConditionSchema.parse({ type: 'monthRange', fromMonth: 1.5, toMonth: 6 }),
    ).toThrow();
  });
});

// ---- dayOfWeek ----

describe('DayOfWeekConditionSchema', () => {
  it('parses a single day', () => {
    const input = { type: 'dayOfWeek' as const, days: [1] };
    expect(DayOfWeekConditionSchema.parse(input)).toEqual(input);
  });

  it('parses multiple days', () => {
    const input = { type: 'dayOfWeek' as const, days: [1, 3, 5] };
    expect(DayOfWeekConditionSchema.parse(input)).toEqual(input);
  });

  it('parses all days', () => {
    const input = { type: 'dayOfWeek' as const, days: [1, 2, 3, 4, 5, 6, 7] };
    expect(DayOfWeekConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects empty days array', () => {
    expect(() => DayOfWeekConditionSchema.parse({ type: 'dayOfWeek', days: [] })).toThrow();
  });

  it('rejects day below 1', () => {
    expect(() => DayOfWeekConditionSchema.parse({ type: 'dayOfWeek', days: [0] })).toThrow();
  });

  it('rejects day above 7', () => {
    expect(() => DayOfWeekConditionSchema.parse({ type: 'dayOfWeek', days: [8] })).toThrow();
  });

  it('rejects non-integer day', () => {
    expect(() => DayOfWeekConditionSchema.parse({ type: 'dayOfWeek', days: [1.5] })).toThrow();
  });
});

// ---- timeRange ----

describe('TimeRangeConditionSchema', () => {
  it('parses a valid time range', () => {
    const input = { type: 'timeRange' as const, fromLocal: '08:00', toLocal: '17:00' };
    expect(TimeRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts midnight-crossing range', () => {
    const input = { type: 'timeRange' as const, fromLocal: '22:00', toLocal: '06:00' };
    expect(TimeRangeConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects invalid time format', () => {
    expect(() =>
      TimeRangeConditionSchema.parse({ type: 'timeRange', fromLocal: '8:00', toLocal: '17:00' }),
    ).toThrow();
  });

  it('rejects missing fromLocal', () => {
    expect(() => TimeRangeConditionSchema.parse({ type: 'timeRange', toLocal: '17:00' })).toThrow();
  });

  it('rejects missing toLocal', () => {
    expect(() =>
      TimeRangeConditionSchema.parse({ type: 'timeRange', fromLocal: '08:00' }),
    ).toThrow();
  });
});

// ---- timeOfDay ----

describe('TimeOfDayConditionSchema', () => {
  it('parses day value', () => {
    const input = { type: 'timeOfDay' as const, value: 'day' as const };
    expect(TimeOfDayConditionSchema.parse(input)).toEqual(input);
  });

  it('parses night value', () => {
    const input = { type: 'timeOfDay' as const, value: 'night' as const };
    expect(TimeOfDayConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects invalid value', () => {
    expect(() => TimeOfDayConditionSchema.parse({ type: 'timeOfDay', value: 'dawn' })).toThrow();
  });

  it('rejects missing value', () => {
    expect(() => TimeOfDayConditionSchema.parse({ type: 'timeOfDay' })).toThrow();
  });
});

// ---- geofenceCircle ----

describe('GeofenceCircleConditionSchema', () => {
  it('parses a valid geofence circle', () => {
    const input = {
      type: 'geofenceCircle' as const,
      center: [40.7128, -74.006] as [number, number],
      radiusMeters: 500,
    };
    expect(GeofenceCircleConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts boundary latitude values', () => {
    expect(
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [-90, 0],
        radiusMeters: 1,
      }),
    ).toBeTruthy();
    expect(
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [90, 0],
        radiusMeters: 1,
      }),
    ).toBeTruthy();
  });

  it('accepts boundary longitude values', () => {
    expect(
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [0, -180],
        radiusMeters: 1,
      }),
    ).toBeTruthy();
    expect(
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [0, 180],
        radiusMeters: 1,
      }),
    ).toBeTruthy();
  });

  it('rejects latitude out of range', () => {
    expect(() =>
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [91, 0],
        radiusMeters: 1,
      }),
    ).toThrow();
    expect(() =>
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [-91, 0],
        radiusMeters: 1,
      }),
    ).toThrow();
  });

  it('rejects longitude out of range', () => {
    expect(() =>
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [0, 181],
        radiusMeters: 1,
      }),
    ).toThrow();
  });

  it('rejects zero radius', () => {
    expect(() =>
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [0, 0],
        radiusMeters: 0,
      }),
    ).toThrow();
  });

  it('rejects negative radius', () => {
    expect(() =>
      GeofenceCircleConditionSchema.parse({
        type: 'geofenceCircle',
        center: [0, 0],
        radiusMeters: -100,
      }),
    ).toThrow();
  });

  it('rejects missing center', () => {
    expect(() =>
      GeofenceCircleConditionSchema.parse({ type: 'geofenceCircle', radiusMeters: 500 }),
    ).toThrow();
  });
});

// ---- geofencePolygon ----

describe('GeofencePolygonConditionSchema', () => {
  it('parses a valid triangle', () => {
    const input = {
      type: 'geofencePolygon' as const,
      points: [
        [0, 0],
        [1, 0],
        [0, 1],
      ] as [number, number][],
    };
    expect(GeofencePolygonConditionSchema.parse(input)).toEqual(input);
  });

  it('parses a polygon with more than 3 points', () => {
    const input = {
      type: 'geofencePolygon' as const,
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as [number, number][],
    };
    expect(GeofencePolygonConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects fewer than 3 points', () => {
    expect(() =>
      GeofencePolygonConditionSchema.parse({
        type: 'geofencePolygon',
        points: [
          [0, 0],
          [1, 0],
        ],
      }),
    ).toThrow();
  });

  it('rejects empty points array', () => {
    expect(() =>
      GeofencePolygonConditionSchema.parse({ type: 'geofencePolygon', points: [] }),
    ).toThrow();
  });

  it('rejects points with out-of-range coordinates', () => {
    expect(() =>
      GeofencePolygonConditionSchema.parse({
        type: 'geofencePolygon',
        points: [
          [91, 0],
          [0, 0],
          [0, 1],
        ],
      }),
    ).toThrow();
  });
});

// ---- country ----

describe('CountryConditionSchema', () => {
  it('parses a single country code', () => {
    const input = { type: 'country' as const, codes: ['US'] };
    expect(CountryConditionSchema.parse(input)).toEqual(input);
  });

  it('parses multiple country codes', () => {
    const input = { type: 'country' as const, codes: ['US', 'CA', 'MX'] };
    expect(CountryConditionSchema.parse(input)).toEqual(input);
  });

  it('rejects empty codes array', () => {
    expect(() => CountryConditionSchema.parse({ type: 'country', codes: [] })).toThrow();
  });

  it('rejects lowercase codes', () => {
    expect(() => CountryConditionSchema.parse({ type: 'country', codes: ['us'] })).toThrow();
  });

  it('rejects codes that are not exactly 2 letters', () => {
    expect(() => CountryConditionSchema.parse({ type: 'country', codes: ['USA'] })).toThrow();
    expect(() => CountryConditionSchema.parse({ type: 'country', codes: ['U'] })).toThrow();
  });

  it('rejects codes with digits', () => {
    expect(() => CountryConditionSchema.parse({ type: 'country', codes: ['U1'] })).toThrow();
  });
});

// ---- weather ----

describe('WeatherConditionSchema', () => {
  it('parses a valid weather condition', () => {
    const input = {
      type: 'weather' as const,
      field: 'temperatureC' as const,
      op: '>' as const,
      value: 30,
    };
    expect(WeatherConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts all field types', () => {
    const fields = [
      'precipitationMmPerHour',
      'snowfallMmPerHour',
      'temperatureC',
      'weatherCode',
    ] as const;
    for (const field of fields) {
      expect(
        WeatherConditionSchema.parse({ type: 'weather', field, op: '==', value: 0 }),
      ).toBeTruthy();
    }
  });

  it('accepts all operators', () => {
    const ops = ['>', '<', '>=', '<=', '=='] as const;
    for (const op of ops) {
      expect(
        WeatherConditionSchema.parse({ type: 'weather', field: 'temperatureC', op, value: 0 }),
      ).toBeTruthy();
    }
  });

  it('accepts negative values', () => {
    expect(
      WeatherConditionSchema.parse({
        type: 'weather',
        field: 'temperatureC',
        op: '<',
        value: -40,
      }),
    ).toBeTruthy();
  });

  it('rejects invalid field', () => {
    expect(() =>
      WeatherConditionSchema.parse({ type: 'weather', field: 'humidity', op: '>', value: 50 }),
    ).toThrow();
  });

  it('rejects invalid operator', () => {
    expect(() =>
      WeatherConditionSchema.parse({ type: 'weather', field: 'temperatureC', op: '!=', value: 0 }),
    ).toThrow();
  });

  it('rejects missing value', () => {
    expect(() =>
      WeatherConditionSchema.parse({ type: 'weather', field: 'temperatureC', op: '>' }),
    ).toThrow();
  });

  it('rejects non-numeric value', () => {
    expect(() =>
      WeatherConditionSchema.parse({
        type: 'weather',
        field: 'temperatureC',
        op: '>',
        value: 'hot',
      }),
    ).toThrow();
  });
});

// ---- nearCity ----

describe('NearCityConditionSchema', () => {
  it('parses a valid nearCity condition', () => {
    const input = {
      type: 'nearCity' as const,
      minPopulation: 100000,
      maxDistanceKm: 50,
    };
    expect(NearCityConditionSchema.parse(input)).toEqual(input);
  });

  it('accepts zero minPopulation', () => {
    expect(
      NearCityConditionSchema.parse({ type: 'nearCity', minPopulation: 0, maxDistanceKm: 10 }),
    ).toBeTruthy();
  });

  it('rejects negative minPopulation', () => {
    expect(() =>
      NearCityConditionSchema.parse({ type: 'nearCity', minPopulation: -1, maxDistanceKm: 10 }),
    ).toThrow();
  });

  it('rejects non-integer minPopulation', () => {
    expect(() =>
      NearCityConditionSchema.parse({ type: 'nearCity', minPopulation: 1.5, maxDistanceKm: 10 }),
    ).toThrow();
  });

  it('rejects zero maxDistanceKm', () => {
    expect(() =>
      NearCityConditionSchema.parse({ type: 'nearCity', minPopulation: 0, maxDistanceKm: 0 }),
    ).toThrow();
  });

  it('rejects negative maxDistanceKm', () => {
    expect(() =>
      NearCityConditionSchema.parse({ type: 'nearCity', minPopulation: 0, maxDistanceKm: -5 }),
    ).toThrow();
  });
});

// ---- discriminated union ----

describe('ConditionSchema (discriminated union)', () => {
  it('parses each valid condition type via the union', () => {
    const validConditions = [
      { type: 'date', monthDay: '01-01' },
      { type: 'dateRange', fromISO: '2024-01-01', toISO: '2024-12-31' },
      { type: 'monthRange', fromMonth: 1, toMonth: 12 },
      { type: 'dayOfWeek', days: [1] },
      { type: 'timeRange', fromLocal: '08:00', toLocal: '17:00' },
      { type: 'timeOfDay', value: 'day' },
      { type: 'geofenceCircle', center: [0, 0], radiusMeters: 100 },
      {
        type: 'geofencePolygon',
        points: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      },
      { type: 'country', codes: ['US'] },
      { type: 'weather', field: 'temperatureC', op: '>', value: 30 },
      { type: 'nearCity', minPopulation: 50000, maxDistanceKm: 25 },
    ];

    for (const c of validConditions) {
      expect(ConditionSchema.parse(c)).toBeTruthy();
    }
  });

  it('rejects unknown condition type', () => {
    expect(() => ConditionSchema.parse({ type: 'humidity', value: 80 })).toThrow();
  });

  it('rejects missing type field', () => {
    expect(() => ConditionSchema.parse({ monthDay: '01-01' })).toThrow();
  });
});
