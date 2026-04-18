import { describe, it, expect } from 'vitest';
import type { ResolverInput, ResolverOverride, ResolverRule, ResolverSignals } from './types.js';
import { resolveImage } from './index.js';

const now = new Date('2024-07-15T12:00:00Z');

const baseSignals: ResolverSignals = {
  location: { lat: 40.7, lon: -74.0, ageMinutes: 5 },
  weather: {
    precipitationMmPerHour: 0,
    snowfallMmPerHour: 0,
    temperatureC: 25,
    weatherCode: 0,
  },
  sunrise: new Date('2024-07-15T05:30:00Z'),
  sunset: new Date('2024-07-15T20:30:00Z'),
  country: 'US',
  nearbyCities: [{ name: 'Test City', population: 500000, distanceKm: 10 }],
};

function makeRule(overrides: Partial<ResolverRule> & { id: string }): ResolverRule {
  return {
    name: `Rule ${overrides.id}`,
    enabled: true,
    priority: 10,
    imageId: `img-${overrides.id}`,
    conditions: [],
    updatedAt: now,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ResolverInput> = {}): ResolverInput {
  return {
    now,
    timezone: 'UTC',
    signals: baseSignals,
    override: null,
    rules: [],
    defaultImageId: null,
    ...overrides,
  };
}

// ---- Override tests ----

describe('resolveImage - overrides', () => {
  it('active override with future expiry wins over all rules', () => {
    const override: ResolverOverride = {
      imageId: 'override-img',
      expiresAt: new Date('2024-07-16T00:00:00Z'),
      source: 'ui',
    };
    const result = resolveImage(
      makeInput({
        override,
        rules: [makeRule({ id: 'r1' })],
      }),
    );
    expect(result.chosenImageId).toBe('override-img');
    expect(result.trace).toHaveLength(0);
  });

  it('active override with past expiry is ignored; rules are evaluated', () => {
    const override: ResolverOverride = {
      imageId: 'expired-img',
      expiresAt: new Date('2024-07-14T00:00:00Z'),
      source: 'ui',
    };
    const result = resolveImage(
      makeInput({
        override,
        rules: [makeRule({ id: 'r1' })],
      }),
    );
    expect(result.chosenImageId).toBe('img-r1');
  });

  it('pinned override (null expiresAt) always wins', () => {
    const override: ResolverOverride = {
      imageId: 'pinned-img',
      expiresAt: null,
      source: 'ios-shortcut',
    };
    const result = resolveImage(makeInput({ override }));
    expect(result.chosenImageId).toBe('pinned-img');
    expect(result.reason).toContain('pinned');
  });

  it('override source is included in the reason string', () => {
    const override: ResolverOverride = {
      imageId: 'img',
      expiresAt: null,
      source: 'ios-shortcut',
    };
    const result = resolveImage(makeInput({ override }));
    expect(result.reason).toContain('ios-shortcut');
  });

  it('override produces an empty trace', () => {
    const override: ResolverOverride = {
      imageId: 'img',
      expiresAt: null,
      source: 'ui',
    };
    const result = resolveImage(makeInput({ override }));
    expect(result.trace).toEqual([]);
  });
});

// ---- Rule evaluation tests ----

describe('resolveImage - rules', () => {
  it('rules sorted by priority descending; highest-priority matching rule wins', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({ id: 'low', priority: 1 }),
          makeRule({ id: 'high', priority: 100 }),
          makeRule({ id: 'mid', priority: 50 }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-high');
  });

  it('priority tie broken by updatedAt descending', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'older',
            priority: 10,
            updatedAt: new Date('2024-07-01T00:00:00Z'),
          }),
          makeRule({
            id: 'newer',
            priority: 10,
            updatedAt: new Date('2024-07-10T00:00:00Z'),
          }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-newer');
  });

  it('rule with empty conditions matches unconditionally', () => {
    const result = resolveImage(makeInput({ rules: [makeRule({ id: 'r1', conditions: [] })] }));
    expect(result.chosenImageId).toBe('img-r1');
    expect(result.trace[0]?.matched).toBe(true);
  });

  it('rule with multiple conditions: all must pass (AND)', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [
              { type: 'monthRange', fromMonth: 7, toMonth: 7 },
              { type: 'dayOfWeek', days: [1] }, // July 15, 2024 is Monday
            ],
          }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-r1');
    expect(result.trace[0]?.matched).toBe(true);
  });

  it('rule with multiple conditions: short-circuits on first failing condition', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [
              { type: 'monthRange', fromMonth: 1, toMonth: 1 }, // fails (July)
              { type: 'dayOfWeek', days: [1] }, // would pass, but not evaluated
            ],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.chosenImageId).toBe('default');
    expect(result.trace[0]?.failedCondition?.type).toBe('monthRange');
  });

  it('disabled rules are skipped entirely and do not appear in the trace', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({ id: 'disabled', enabled: false, priority: 100 }),
          makeRule({ id: 'enabled', priority: 1 }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-enabled');
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]?.ruleId).toBe('enabled');
  });

  it('only the first matching rule is returned; lower-priority rules are not evaluated', () => {
    const result = resolveImage(
      makeInput({
        rules: [makeRule({ id: 'high', priority: 20 }), makeRule({ id: 'low', priority: 10 })],
      }),
    );
    expect(result.chosenImageId).toBe('img-high');
    expect(result.trace).toHaveLength(1);
  });

  it('trace contains entries in priority order', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'p20',
            priority: 20,
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
          makeRule({
            id: 'p10',
            priority: 10,
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.trace[0]?.ruleId).toBe('p20');
    expect(result.trace[1]?.ruleId).toBe('p10');
  });

  it('trace entry for a matched rule has matched: true and no failedCondition', () => {
    const result = resolveImage(makeInput({ rules: [makeRule({ id: 'r1' })] }));
    expect(result.trace[0]?.matched).toBe(true);
    expect(result.trace[0]?.failedCondition).toBeUndefined();
  });

  it('trace entry for a failed rule has matched: false and failedCondition with type and detail', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.trace[0]?.matched).toBe(false);
    expect(result.trace[0]?.failedCondition).toBeDefined();
    expect(result.trace[0]?.failedCondition?.type).toBe('monthRange');
    expect(typeof result.trace[0]?.failedCondition?.detail).toBe('string');
  });

  it('mix of enabled and disabled rules: disabled rules have no trace entry', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({ id: 'off1', enabled: false, priority: 30 }),
          makeRule({
            id: 'fail',
            priority: 20,
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
          makeRule({ id: 'off2', enabled: false, priority: 15 }),
          makeRule({ id: 'match', priority: 10 }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-match');
    expect(result.trace).toHaveLength(2);
    expect(result.trace.map((t) => t.ruleId)).toEqual(['fail', 'match']);
  });

  it('all rules disabled: falls through to default image', () => {
    const result = resolveImage(
      makeInput({
        rules: [makeRule({ id: 'r1', enabled: false }), makeRule({ id: 'r2', enabled: false })],
        defaultImageId: 'fallback',
      }),
    );
    expect(result.chosenImageId).toBe('fallback');
    expect(result.reason).toBe('default image');
    expect(result.trace).toHaveLength(0);
  });

  it('single rule with a single condition that matches', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'monthRange', fromMonth: 7, toMonth: 7 }],
          }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-r1');
  });

  it('single rule with a single condition that fails', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'monthRange', fromMonth: 12, toMonth: 12 }],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.chosenImageId).toBe('default');
  });

  it('multiple rules where the first (highest priority) fails and a lower-priority rule matches', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'high',
            priority: 20,
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
          makeRule({ id: 'low', priority: 10 }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-low');
    expect(result.trace).toHaveLength(2);
  });

  it('rule name and ID are included in the reason string for a rule-based decision', () => {
    const result = resolveImage(
      makeInput({
        rules: [makeRule({ id: 'abc-123', name: 'Summer vibes' })],
      }),
    );
    expect(result.reason).toContain('Summer vibes');
    expect(result.reason).toContain('abc-123');
  });

  it('priority values can be negative or zero', () => {
    const result = resolveImage(
      makeInput({
        rules: [makeRule({ id: 'neg', priority: -5 }), makeRule({ id: 'zero', priority: 0 })],
      }),
    );
    expect(result.chosenImageId).toBe('img-zero');
  });

  it('rules with the same image but different conditions are evaluated independently', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            priority: 20,
            imageId: 'shared-img',
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
          makeRule({
            id: 'r2',
            priority: 10,
            imageId: 'shared-img',
            conditions: [],
          }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('shared-img');
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0]?.matched).toBe(false);
    expect(result.trace[1]?.matched).toBe(true);
  });
});

// ---- Default image and no-image tests ----

describe('resolveImage - fallbacks', () => {
  it('no rules match, default image is returned', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
        ],
        defaultImageId: 'default-img',
      }),
    );
    expect(result.chosenImageId).toBe('default-img');
    expect(result.reason).toBe('default image');
  });

  it('no rules match, no default image, result has empty chosenImageId', () => {
    const result = resolveImage(
      makeInput({
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'monthRange', fromMonth: 1, toMonth: 1 }],
          }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('');
    expect(result.reason).toBe('no image selected');
  });

  it('zero rules (empty array): falls through to default image', () => {
    const result = resolveImage(makeInput({ rules: [], defaultImageId: 'fallback' }));
    expect(result.chosenImageId).toBe('fallback');
    expect(result.reason).toBe('default image');
  });

  it('default image is null and no rules match: returns no-image result', () => {
    const result = resolveImage(makeInput({ rules: [], defaultImageId: null }));
    expect(result.chosenImageId).toBe('');
    expect(result.reason).toBe('no image selected');
  });
});

// ---- Location staleness tests ----

describe('resolveImage - location staleness', () => {
  it('rule with stale location signal: location-dependent conditions fail', () => {
    const result = resolveImage(
      makeInput({
        signals: {
          ...baseSignals,
          location: { lat: 40.7, lon: -74.0, ageMinutes: 200 },
        },
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'geofenceCircle', center: [40.7, -74.0], radiusMeters: 1000 }],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.chosenImageId).toBe('default');
    expect(result.trace[0]?.failedCondition?.detail).toBe('location stale');
  });

  it('rule with null location signal: location-dependent conditions fail', () => {
    const result = resolveImage(
      makeInput({
        signals: { ...baseSignals, location: null },
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'country', codes: ['US'] }],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.chosenImageId).toBe('default');
    expect(result.trace[0]?.failedCondition?.detail).toBe('no location available');
  });

  it('rule mixing time-based and location-based conditions: time passes, location fails due to staleness', () => {
    const result = resolveImage(
      makeInput({
        signals: {
          ...baseSignals,
          location: { lat: 40.7, lon: -74.0, ageMinutes: 200 },
        },
        rules: [
          makeRule({
            id: 'r1',
            conditions: [
              { type: 'monthRange', fromMonth: 7, toMonth: 7 }, // passes
              { type: 'geofenceCircle', center: [40.7, -74.0], radiusMeters: 1000 }, // stale
            ],
          }),
        ],
        defaultImageId: 'default',
      }),
    );
    expect(result.chosenImageId).toBe('default');
    expect(result.trace[0]?.failedCondition?.type).toBe('geofenceCircle');
    expect(result.trace[0]?.failedCondition?.detail).toBe('location stale');
  });
});

// ---- Timezone tests ----

describe('resolveImage - timezone', () => {
  it('timezone fallback to UTC when timezone is null', () => {
    const result = resolveImage(
      makeInput({
        timezone: null,
        rules: [
          makeRule({
            id: 'r1',
            conditions: [{ type: 'monthRange', fromMonth: 7, toMonth: 7 }],
          }),
        ],
      }),
    );
    expect(result.chosenImageId).toBe('img-r1');
  });
});
