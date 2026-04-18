import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const TraceEntrySchema = z.object({
  ruleId: z.string().nullable(),
  ruleName: z.string().nullable(),
  matched: z.boolean(),
  failedCondition: z
    .object({
      type: z.string(),
      detail: z.string(),
    })
    .optional(),
});

export const NearbyCitySchema = z.object({
  name: z.string(),
  population: z.number().int().nonnegative(),
  distanceKm: z.number().nonnegative(),
});

export const WeatherDataSchema = z.object({
  precipitationMmPerHour: z.number(),
  snowfallMmPerHour: z.number(),
  temperatureC: z.number(),
  weatherCode: z.number(),
});

export const LocationSignalSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  ageMinutes: z.number(),
});

export const SignalsSnapshotSchema = z.object({
  location: LocationSignalSchema.nullable(),
  weather: WeatherDataSchema.nullable(),
  sunrise: TimestampSchema,
  sunset: TimestampSchema,
  country: z.string().nullable(),
  nearbyCities: z.array(NearbyCitySchema),
});

export const DecisionSchema = z.object({
  at: TimestampSchema,
  chosenImageId: z.string(),
  reason: z.string(),
  trace: z.array(TraceEntrySchema),
  uploaded: z.boolean(),
  uploadSkippedReason: z.enum(['hash-match', 'rate-limit']).nullable(),
  signalsSnapshot: SignalsSnapshotSchema,
});

export type Decision = z.infer<typeof DecisionSchema>;
export type TraceEntry = z.infer<typeof TraceEntrySchema>;
export type SignalsSnapshot = z.infer<typeof SignalsSnapshotSchema>;
export type WeatherData = z.infer<typeof WeatherDataSchema>;
export type NearbyCity = z.infer<typeof NearbyCitySchema>;
export type LocationSignal = z.infer<typeof LocationSignalSchema>;
