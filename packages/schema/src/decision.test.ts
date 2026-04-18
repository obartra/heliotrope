import { describe, it, expect } from 'vitest';
import {
  DecisionSchema,
  TraceEntrySchema,
  WeatherDataSchema,
  LocationSignalSchema,
  NearbyCitySchema,
  SignalsSnapshotSchema,
} from './decision.js';

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

const ts = { seconds: 1700000000, nanoseconds: 0 };

const validSignals = {
  location: { lat: 40.7, lon: -74.0, ageMinutes: 5 },
  weather: {
    precipitationMmPerHour: 0,
    snowfallMmPerHour: 0,
    temperatureC: 22.5,
    weatherCode: 0,
  },
  sunrise: ts,
  sunset: { seconds: 1700040000, nanoseconds: 0 },
  country: 'US',
  nearbyCities: [{ name: 'Test City', population: 500000, distanceKm: 12.5 }],
};

const validDecision = {
  at: ts,
  chosenImageId: 'img-001',
  reason: 'Rule "Winter" matched',
  trace: [
    {
      ruleId: 'rule-001',
      ruleName: 'Winter',
      matched: true,
    },
  ],
  uploaded: true,
  uploadSkippedReason: null,
  signalsSnapshot: validSignals,
};

// ---- TraceEntrySchema ----

describe('TraceEntrySchema', () => {
  it('parses a matched trace entry', () => {
    const entry = { ruleId: 'r1', ruleName: 'Summer', matched: true };
    expect(TraceEntrySchema.parse(entry)).toEqual(entry);
  });

  it('parses a failed trace entry with failedCondition', () => {
    const entry = {
      ruleId: 'r1',
      ruleName: 'Summer',
      matched: false,
      failedCondition: { type: 'monthRange', detail: 'month 1 not in [6, 8]' },
    };
    expect(TraceEntrySchema.parse(entry)).toEqual(entry);
  });

  it('accepts null ruleId and ruleName', () => {
    const entry = { ruleId: null, ruleName: null, matched: false };
    expect(TraceEntrySchema.parse(entry)).toEqual(entry);
  });

  it('allows omitting failedCondition', () => {
    const result = TraceEntrySchema.parse({ ruleId: 'r1', ruleName: 'X', matched: true });
    expect(result.failedCondition).toBeUndefined();
  });

  it('rejects missing matched', () => {
    expect(() => TraceEntrySchema.parse({ ruleId: 'r1', ruleName: 'X' })).toThrow();
  });

  it('rejects missing ruleId', () => {
    expect(() => TraceEntrySchema.parse({ ruleName: 'X', matched: true })).toThrow();
  });

  it('rejects non-boolean matched', () => {
    expect(() => TraceEntrySchema.parse({ ruleId: 'r1', ruleName: 'X', matched: 'yes' })).toThrow();
  });
});

// ---- WeatherDataSchema ----

describe('WeatherDataSchema', () => {
  it('parses valid weather data', () => {
    const data = {
      precipitationMmPerHour: 2.5,
      snowfallMmPerHour: 0,
      temperatureC: -5,
      weatherCode: 61,
    };
    expect(WeatherDataSchema.parse(data)).toEqual(data);
  });

  it('rejects missing field', () => {
    expect(() =>
      WeatherDataSchema.parse({
        precipitationMmPerHour: 0,
        snowfallMmPerHour: 0,
        temperatureC: 20,
      }),
    ).toThrow();
  });

  it('rejects non-number field', () => {
    expect(() =>
      WeatherDataSchema.parse({
        precipitationMmPerHour: 0,
        snowfallMmPerHour: 0,
        temperatureC: 'warm',
        weatherCode: 0,
      }),
    ).toThrow();
  });
});

// ---- LocationSignalSchema ----

describe('LocationSignalSchema', () => {
  it('parses valid location signal', () => {
    const loc = { lat: 40.7, lon: -74.0, ageMinutes: 5 };
    expect(LocationSignalSchema.parse(loc)).toEqual(loc);
  });

  it('rejects missing ageMinutes', () => {
    expect(() => LocationSignalSchema.parse({ lat: 0, lon: 0 })).toThrow();
  });
});

// ---- NearbyCitySchema ----

describe('NearbyCitySchema', () => {
  it('parses valid nearby city', () => {
    const city = { name: 'Springfield', population: 150000, distanceKm: 8.3 };
    expect(NearbyCitySchema.parse(city)).toEqual(city);
  });

  it('accepts zero population', () => {
    expect(NearbyCitySchema.parse({ name: 'Hamlet', population: 0, distanceKm: 1 })).toBeTruthy();
  });

  it('accepts zero distance', () => {
    expect(NearbyCitySchema.parse({ name: 'Here', population: 100, distanceKm: 0 })).toBeTruthy();
  });

  it('rejects negative population', () => {
    expect(() => NearbyCitySchema.parse({ name: 'X', population: -1, distanceKm: 1 })).toThrow();
  });

  it('rejects non-integer population', () => {
    expect(() => NearbyCitySchema.parse({ name: 'X', population: 1.5, distanceKm: 1 })).toThrow();
  });

  it('rejects negative distance', () => {
    expect(() => NearbyCitySchema.parse({ name: 'X', population: 100, distanceKm: -1 })).toThrow();
  });
});

// ---- SignalsSnapshotSchema ----

describe('SignalsSnapshotSchema', () => {
  it('parses a full signals snapshot', () => {
    expect(SignalsSnapshotSchema.parse(validSignals)).toEqual(validSignals);
  });

  it('accepts null location', () => {
    expect(SignalsSnapshotSchema.parse({ ...validSignals, location: null })).toBeTruthy();
  });

  it('accepts null weather', () => {
    expect(SignalsSnapshotSchema.parse({ ...validSignals, weather: null })).toBeTruthy();
  });

  it('accepts null country', () => {
    expect(SignalsSnapshotSchema.parse({ ...validSignals, country: null })).toBeTruthy();
  });

  it('accepts empty nearbyCities', () => {
    expect(SignalsSnapshotSchema.parse({ ...validSignals, nearbyCities: [] })).toBeTruthy();
  });

  it('rejects missing sunrise', () => {
    expect(() => SignalsSnapshotSchema.parse(omit(validSignals, 'sunrise'))).toThrow();
  });

  it('rejects missing sunset', () => {
    expect(() => SignalsSnapshotSchema.parse(omit(validSignals, 'sunset'))).toThrow();
  });
});

// ---- DecisionSchema ----

describe('DecisionSchema', () => {
  it('parses a valid decision', () => {
    expect(DecisionSchema.parse(validDecision)).toEqual(validDecision);
  });

  it('accepts hash-match skip reason', () => {
    expect(
      DecisionSchema.parse({ ...validDecision, uploadSkippedReason: 'hash-match' }),
    ).toBeTruthy();
  });

  it('accepts rate-limit skip reason', () => {
    expect(
      DecisionSchema.parse({ ...validDecision, uploadSkippedReason: 'rate-limit' }),
    ).toBeTruthy();
  });

  it('accepts null uploadSkippedReason', () => {
    expect(DecisionSchema.parse({ ...validDecision, uploadSkippedReason: null })).toBeTruthy();
  });

  it('accepts empty trace array', () => {
    expect(DecisionSchema.parse({ ...validDecision, trace: [] })).toBeTruthy();
  });

  it('rejects invalid uploadSkippedReason', () => {
    expect(() =>
      DecisionSchema.parse({ ...validDecision, uploadSkippedReason: 'timeout' }),
    ).toThrow();
  });

  it('rejects missing at', () => {
    expect(() => DecisionSchema.parse(omit(validDecision, 'at'))).toThrow();
  });

  it('rejects missing chosenImageId', () => {
    expect(() => DecisionSchema.parse(omit(validDecision, 'chosenImageId'))).toThrow();
  });

  it('rejects missing reason', () => {
    expect(() => DecisionSchema.parse(omit(validDecision, 'reason'))).toThrow();
  });

  it('rejects missing uploaded', () => {
    expect(() => DecisionSchema.parse(omit(validDecision, 'uploaded'))).toThrow();
  });

  it('rejects missing signalsSnapshot', () => {
    expect(() => DecisionSchema.parse(omit(validDecision, 'signalsSnapshot'))).toThrow();
  });

  it('rejects non-boolean uploaded', () => {
    expect(() => DecisionSchema.parse({ ...validDecision, uploaded: 'yes' })).toThrow();
  });
});
