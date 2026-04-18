import type { Condition } from '@heliotrope/schema';

export interface MatchResult {
  matched: boolean;
  detail: string;
}

export interface ResolverSignals {
  location: {
    lat: number;
    lon: number;
    ageMinutes: number;
  } | null;
  weather: {
    precipitationMmPerHour: number;
    snowfallMmPerHour: number;
    temperatureC: number;
    weatherCode: number;
  } | null;
  sunrise: Date;
  sunset: Date;
  country: string | null;
  nearbyCities: {
    name: string;
    population: number;
    distanceKm: number;
  }[];
}

export interface ResolverOverride {
  imageId: string;
  expiresAt: Date | null;
  source: 'ui' | 'ios-shortcut';
}

export interface ResolverRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  imageId: string;
  conditions: Condition[];
  updatedAt: Date;
}

export interface ResolverInput {
  now: Date;
  timezone: string | null;
  signals: ResolverSignals;
  override: ResolverOverride | null;
  rules: ResolverRule[];
  defaultImageId: string | null;
}

export interface TraceEntry {
  ruleId: string | null;
  ruleName: string | null;
  matched: boolean;
  failedCondition?: {
    type: string;
    detail: string;
  };
}

export interface ResolverOutput {
  chosenImageId: string;
  reason: string;
  trace: TraceEntry[];
}

export type ConditionMatcher<T extends Condition> = (
  condition: T,
  signals: ResolverSignals,
  now: Date,
  timezone: string,
) => MatchResult;
