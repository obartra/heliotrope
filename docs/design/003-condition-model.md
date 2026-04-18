# 003 - Condition Model

## Context

The resolver (see [004-resolver.md](004-resolver.md)) evaluates rules to pick an avatar image. Each rule contains a list of conditions that must all pass for the rule to match. Conditions cover a wide variety of real-world signals: calendar dates, time of day, geographic location, weather, and proximity to cities.

The system needs to support 11 condition types at launch, and it must be straightforward to add new types later without modifying the resolver core or breaking existing conditions. Each condition type also needs a corresponding UI editor so users can configure it visually, and a Zod schema so the same validation runs on both client and server.

This document defines the condition data model, the tagged union structure, the contract each condition type must fulfill, and the process for adding new condition types.

## Proposal

### Tagged union

A `Condition` is a TypeScript discriminated union keyed on the `type` field. Each variant carries only the data its matcher needs. The Zod schema in `packages/schema/src/condition.ts` uses `z.discriminatedUnion("type", [...])` so that parsing and validation are type-safe and produce clear error messages when a variant is invalid.

The `Condition` tagged union is defined in the architecture doc (000, section 'The condition model') with 11 variants. The Zod implementation in `packages/schema/src/condition.ts` uses `z.discriminatedUnion('type', [...])` with one named schema per variant.

TypeScript types are derived from the Zod schemas via `z.infer`, not hand-written. The Zod schema is the source of truth.

### Condition combination semantics

- Conditions within a single rule combine with **AND**. Every condition must match for the rule to win.
- For **OR** semantics, create multiple rules with the same image and different condition sets.
- **NOT** is not supported in v1. If needed later, a `{ type: "not"; inner: Condition }` wrapper variant can be added to the union without changing existing matchers.

### Matcher contract

Each condition type has a matcher function in `apps/functions/src/resolver/conditions/{type}.ts`. All matchers conform to this interface:

```ts
interface MatchResult {
  matched: boolean;
  detail: string; // human-readable explanation, e.g. "01-01 is within window [12-31, 01-02]"
}

type ConditionMatcher<T extends Condition> = (
  condition: T,
  signals: ResolverSignals,
  now: Date,
  timezone: string, // always a resolved IANA string; the resolver converts null to "UTC" before calling matchers
) => MatchResult;
```

Key rules for matchers:

1. **Pure functions.** No side effects, no I/O. All external data arrives through `signals`.
2. **Location staleness.** Matchers that depend on location (`geofenceCircle`, `geofencePolygon`, `country`, `nearCity`) must check `signals.location.ageMinutes`. If the location is older than 120 minutes, return `{ matched: false, detail: "location stale" }`. If location is `null`, return `{ matched: false, detail: "no location available" }`.
3. **Timezone awareness.** Time-based matchers (`timeRange`, `timeOfDay`, `date`, `dateRange`, `monthRange`, `dayOfWeek`) use the `timezone` parameter (IANA string derived from location, falling back to `"UTC"`) to interpret "now" in local time.
4. **Detail strings.** Every result includes a human-readable `detail` explaining what was compared and why it matched or failed. These strings appear in the decision trace.

### Condition type details

**`date`** matches a specific month-day combination, with an optional window. `monthDay` is `"MM-DD"` format. `windowDaysBefore` (default 0) and `windowDaysAfter` (default 0) expand the match window. For example, `{ type: "date", monthDay: "01-01", windowDaysBefore: 1, windowDaysAfter: 1 }` matches December 31 through January 2. Year-boundary wrapping is handled correctly.

**`dateRange`** matches any date from `fromISO` to `toISO` inclusive. Both are `"YYYY-MM-DD"` strings. If `fromISO > toISO`, the condition never matches (no wrapping; use two rules instead).

**`monthRange`** matches when the current month (1-12) falls within the range. Supports year wrapping: `{ fromMonth: 11, toMonth: 2 }` matches November through February.

**`dayOfWeek`** matches when the current ISO weekday (1=Monday through 7=Sunday) is in the `days` array. The array must be non-empty.

**`timeRange`** matches when the current local time is within `[fromLocal, toLocal)`. Times are `"HH:mm"` strings in 24-hour format. Supports midnight wrapping: `{ fromLocal: "22:00", toLocal: "06:00" }` matches 10 PM to 6 AM. The start is inclusive, the end is exclusive.

**`timeOfDay`** matches `"day"` if now is between sunrise and sunset (inclusive of sunrise, exclusive of sunset), or `"night"` otherwise. Sunrise and sunset come from `signals.sunrise` and `signals.sunset`, computed externally via `suncalc`.

**`geofenceCircle`** matches when the current location is within `radiusMeters` of `center` using the Haversine formula. `center` is `[latitude, longitude]`.

**`geofencePolygon`** matches when the current location is inside the polygon defined by `points` (array of `[latitude, longitude]` pairs). Uses a standard ray-casting point-in-polygon algorithm. The polygon is implicitly closed (last point connects to first). Minimum 3 points required by the Zod schema.

**`country`** matches when `signals.country` (ISO 3166-1 alpha-2 code from the geocoding signal) is included in the `codes` array. The comparison is case-insensitive. The `codes` array must be non-empty.

**`weather`** matches when the specified `field` from `signals.weather` satisfies the comparison `op` against `value`. If `signals.weather` is `null`, the matcher returns `{ matched: false, detail: "no weather data available" }`.

**`nearCity`** matches when any city in `signals.nearbyCities` has `population >= minPopulation` and `distanceKm <= maxDistanceKm`. The nearby cities signal is populated by the Open-Meteo geocoding API (see below). If `signals.nearbyCities` is empty, the matcher returns `{ matched: false, detail: "no nearby cities in signal data" }`.

### nearCity signal collection

The `nearCity` condition relies on the `nearbyCities` signal, which is collected by the signal layer (not by the matcher itself). The signal collector:

1. Calls Open-Meteo's geocoding API (`https://geocoding-api.open-meteo.com/v1/search`) with reverse lookup parameters and the current lat/lon.
2. Receives a list of nearby places with their names, populations, country codes, and coordinates.
3. Computes great-circle distance from the current location to each place.
4. Stores the result as `Array<{ name: string; population: number; distanceKm: number }>` in signals.
5. Caches the response per lat/lon (rounded to 2 decimal places for cache key stability) for 1 hour in function memory.

The matcher itself is a pure filter over this pre-collected array.

### Zod schemas

All schemas live in `packages/schema/src/condition.ts`. Each condition type has its own named schema:

```ts
const DateConditionSchema = z.object({
  type: z.literal('date'),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/),
  windowDaysBefore: z.number().int().min(0).optional(),
  windowDaysAfter: z.number().int().min(0).optional(),
});

// ... one schema per type ...

const ConditionSchema = z.discriminatedUnion('type', [
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

type Condition = z.infer<typeof ConditionSchema>;
```

Validation rules enforced by the schemas:

- `monthDay` regex matches `MM-DD` with valid ranges (the regex enforces format; runtime validation in the matcher handles invalid dates like `02-30`).
- `fromMonth` and `toMonth` are integers in `[1, 12]`.
- `days` is a non-empty array of integers in `[1, 7]`.
- `fromLocal` and `toLocal` match `HH:mm` format.
- `center` is a tuple of two numbers (latitude in `[-90, 90]`, longitude in `[-180, 180]`).
- `points` has a minimum length of 3.
- `codes` is a non-empty array of uppercase two-letter strings.
- `op` is one of the five comparison operators.
- `field` is one of the four weather fields.
- `radiusMeters` is a positive number.
- `minPopulation` is a non-negative integer.
- `maxDistanceKm` is a positive number.

### Editor components

Each condition type has a dedicated editor component in `apps/web/src/components/ConditionEditor/`, listed in the architecture doc's repository layout (000). The editor components are also detailed in design doc 006.

### Adding a new condition type

To add a new condition type (for example, `"humidity"`):

1. **Schema.** Add a new Zod object schema in `packages/schema/src/condition.ts` and include it in the `ConditionSchema` discriminated union.
2. **Matcher.** Create `apps/functions/src/resolver/conditions/humidity.ts` exporting a function matching the `ConditionMatcher` interface. Add `humidity.test.ts` alongside it.
3. **Signal.** If the new condition depends on a signal not yet collected, add a signal collector in `apps/functions/src/signals/` and wire it into the scheduled function. Extend the `ResolverSignals` type.
4. **Dispatcher.** Register the new type in the condition dispatcher in `apps/functions/src/resolver/conditions/index.ts` (a map from `type` string to matcher function).
5. **Editor.** Create `apps/web/src/components/ConditionEditor/HumidityCondition.tsx` with a colocated `HumidityCondition.stories.tsx`.
6. **Condition picker.** Add the new type to the "Add condition" dropdown in the rule editor.
7. **Tests.** Ensure the new matcher has edge-case coverage, the schema rejects invalid input, and the editor has Storybook stories.

No changes to the resolver core (`apps/functions/src/resolver/index.ts`) are required because it dispatches by `type` through the condition registry.

## Alternatives considered

**Class-based condition hierarchy.** Each condition type could be a class extending a `BaseCondition` with `match()` and `render()` methods. This bundles matcher and editor logic together, but it couples the server-side matcher to React rendering code. A tagged union with separate matcher functions and editor components keeps the server bundle free of UI dependencies and vice versa.

**Single flat object with optional fields.** Instead of a discriminated union, one could use a single `Condition` type with a `type` field and every possible field marked optional. This is simpler to serialize but loses type safety. The compiler cannot verify that a `weather` condition has `field`, `op`, and `value` populated. The discriminated union makes each variant's required fields explicit.

**Condition DSL or expression language.** A string-based expression language (for example `weather.temperatureC > 30`) would be more flexible but harder to validate, harder to build a UI for, and open to injection risks. The tagged union constrains conditions to known, validated structures.

**Embedding signal collection in matchers.** Each matcher could fetch its own external data (weather, geocoding). This would make matchers impure and introduce network calls inside the hot evaluation loop. Keeping signal collection in a separate pre-fetch step and passing signals as data to pure matchers is easier to test, cache, and reason about.

## Open questions

- Should the `monthDay` Zod schema reject impossible dates like `02-30` at parse time, or is format-only validation sufficient? Current approach: format-only regex at the schema level, with graceful handling of impossible dates in the matcher.
- For `geofencePolygon`, should the schema enforce winding order (e.g., counter-clockwise), or should the ray-casting algorithm handle both orientations?
- Should `weather` support string-valued comparisons for `weatherCode` (e.g., WMO code descriptions), or is numeric comparison sufficient?
- Should `nearCity` expose the Open-Meteo cache TTL as a configurable parameter, or is 1 hour fixed?
- What is the maximum number of conditions per rule? Should the schema enforce a cap (e.g., 20) to prevent accidental performance degradation?

## Acceptance criteria

- `packages/schema/src/condition.ts` exports a `ConditionSchema` discriminated union and individual per-type schemas, all with `z.infer` types re-exported.
- Schema tests in `packages/schema` achieve 100% coverage: every valid variant parses, every required field is enforced, invalid values (wrong type, out-of-range, malformed strings) are rejected.
- `apps/functions/src/resolver/conditions/` contains one matcher file per condition type, each exporting a function matching the `ConditionMatcher` interface.
- Each matcher has a colocated `.test.ts` file with edge-case coverage:
  - `date`: year-boundary wrapping with window (e.g., Dec 31 matching Jan 1 with `windowDaysBefore: 1`).
  - `dateRange`: single-day range, multi-month range, `fromISO > toISO` returns no match.
  - `monthRange`: same-month range, year-wrapping range (Nov to Feb).
  - `dayOfWeek`: single day, multiple days, all days.
  - `timeRange`: midnight-crossing range, same start and end, range within a single hour.
  - `timeOfDay`: exact sunrise, exact sunset, polar edge cases (if sunrise/sunset data indicates 24h day or night).
  - `geofenceCircle`: point on boundary, point just inside, point just outside, zero-radius circle.
  - `geofencePolygon`: point on edge, point on vertex, concave polygon, minimum-point triangle.
  - `country`: single code match, multi-code match, no match, case-insensitive comparison.
  - `weather`: each operator, null weather signal, boundary values.
  - `nearCity`: city at exact max distance, no cities in signal, city below population threshold.
  - All location-dependent matchers: stale location (>120 min) returns `matched: false` with "location stale" detail; null location returns `matched: false` with appropriate detail.
- `apps/functions/src/resolver/conditions/index.ts` exports a dispatcher that maps each condition `type` to its matcher, with no fallthrough for unknown types (throws or returns an error).
- Coverage for all condition matchers is 95% or above.
- Each editor component in `apps/web/src/components/ConditionEditor/` has a colocated `.stories.tsx` with at least three stories (default, populated, invalid input).
- The "Add condition" dropdown in the rule editor lists all 11 condition types.
- Adding a 12th condition type requires changes only in the files listed in the "Adding a new condition type" section, with no modification to the resolver core.
