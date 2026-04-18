import { z } from 'zod';

const latSchema = z.number().min(-90).max(90);
const lonSchema = z.number().min(-180).max(180);
const latLonTuple = z.tuple([latSchema, lonSchema]);

export const DateConditionSchema = z.object({
  type: z.literal('date'),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/),
  windowDaysBefore: z.number().int().min(0).optional(),
  windowDaysAfter: z.number().int().min(0).optional(),
});

export const DateRangeConditionSchema = z.object({
  type: z.literal('dateRange'),
  fromISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const MonthRangeConditionSchema = z.object({
  type: z.literal('monthRange'),
  fromMonth: z.number().int().min(1).max(12),
  toMonth: z.number().int().min(1).max(12),
});

export const DayOfWeekConditionSchema = z.object({
  type: z.literal('dayOfWeek'),
  days: z.array(z.number().int().min(1).max(7)).nonempty(),
});

export const TimeRangeConditionSchema = z.object({
  type: z.literal('timeRange'),
  fromLocal: z.string().regex(/^\d{2}:\d{2}$/),
  toLocal: z.string().regex(/^\d{2}:\d{2}$/),
});

export const TimeOfDayConditionSchema = z.object({
  type: z.literal('timeOfDay'),
  value: z.enum(['day', 'night']),
});

export const GeofenceCircleConditionSchema = z.object({
  type: z.literal('geofenceCircle'),
  center: latLonTuple,
  radiusMeters: z.number().positive(),
});

export const GeofencePolygonConditionSchema = z.object({
  type: z.literal('geofencePolygon'),
  points: z.array(latLonTuple).min(3),
});

export const CountryConditionSchema = z.object({
  type: z.literal('country'),
  codes: z.array(z.string().regex(/^[A-Z]{2}$/)).nonempty(),
});

export const WeatherConditionSchema = z.object({
  type: z.literal('weather'),
  field: z.enum(['precipitationMmPerHour', 'snowfallMmPerHour', 'temperatureC', 'weatherCode']),
  op: z.enum(['>', '<', '>=', '<=', '==']),
  value: z.number(),
});

export const NearCityConditionSchema = z.object({
  type: z.literal('nearCity'),
  minPopulation: z.number().int().min(0),
  maxDistanceKm: z.number().positive(),
});

export const ConditionSchema = z.discriminatedUnion('type', [
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
]);

export type Condition = z.infer<typeof ConditionSchema>;
export type DateCondition = z.infer<typeof DateConditionSchema>;
export type DateRangeCondition = z.infer<typeof DateRangeConditionSchema>;
export type MonthRangeCondition = z.infer<typeof MonthRangeConditionSchema>;
export type DayOfWeekCondition = z.infer<typeof DayOfWeekConditionSchema>;
export type TimeRangeCondition = z.infer<typeof TimeRangeConditionSchema>;
export type TimeOfDayCondition = z.infer<typeof TimeOfDayConditionSchema>;
export type GeofenceCircleCondition = z.infer<typeof GeofenceCircleConditionSchema>;
export type GeofencePolygonCondition = z.infer<typeof GeofencePolygonConditionSchema>;
export type CountryCondition = z.infer<typeof CountryConditionSchema>;
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
export type NearCityCondition = z.infer<typeof NearCityConditionSchema>;
