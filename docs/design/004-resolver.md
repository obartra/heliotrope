# 004 - Resolver

## Context

Heliotrope needs to decide which avatar image to display on Slack at any given moment. This decision depends on the user's rules, an optional manual override, a default fallback image, and a set of real-world signals (location, weather, time, nearby cities). The logic that makes this decision must be deterministic, testable, and completely decoupled from I/O so it can run in both the scheduled Cloud Function and the on-demand `syncNow` and `testRule` endpoints.

The resolver is the core of the system. Every other component (signal collectors, the scheduler, the Slack client, the UI's "test rule" feature) depends on the resolver producing a consistent, explainable result given the same inputs.

This document defines the resolver's interface, evaluation order, staleness handling, trace output, and testing requirements. The condition matchers it dispatches to are defined in [003-condition-model.md](003-condition-model.md).

## Proposal

### Function signature

The resolver is a single pure function with no side effects and no I/O:

```ts
interface ResolverInput {
  now: Date;
  timezone: string | null; // IANA timezone from location; falls back to "UTC" if null
  signals: ResolverSignals;
  override: Override | null;
  rules: Rule[];
  defaultImageId: string | null;
}

interface ResolverSignals {
  location: {
    lat: number;
    lon: number;
    ageMinutes: number;
  } | null;
  weather: WeatherFix | null;
  sunrise: Date;
  sunset: Date;
  country: string | null; // ISO 3166-1 alpha-2
  nearbyCities: Array<{
    name: string;
    population: number;
    distanceKm: number;
  }>;
}

interface ResolverOutput {
  chosenImageId: string;
  reason: string;
  trace: TraceEntry[];
}

interface TraceEntry {
  ruleId: string | null;
  ruleName: string | null;
  matched: boolean;
  failedCondition?: {
    type: string;
    detail: string;
  };
}

function resolveImage(input: ResolverInput): ResolverOutput;
```

The function lives in `apps/functions/src/resolver/index.ts`.

### Evaluation order

The resolver follows a strict four-step cascade:

**Step 1: Active override.** If `input.override` is non-null and either `expiresAt` is null (pinned) or `expiresAt > input.now`, the override wins immediately. No rules are evaluated. The trace is empty. The reason is `"override (source: {source}, expires: {expiresAt or 'pinned'})"`.

**Step 2: Rules.** Filter to enabled rules only (`rule.enabled === true`). Sort the remaining rules by `priority` descending. If two rules share the same priority, break the tie by `updatedAt` descending (most recently updated wins). Iterate through the sorted rules in order. For each rule:

1. If `rule.conditions` is empty, the rule matches unconditionally. Record a trace entry with `matched: true`.
2. Otherwise, evaluate each condition via the condition dispatcher (see [003-condition-model.md](003-condition-model.md)). All conditions must match (AND semantics). Evaluation is short-circuiting: on the first failing condition, stop evaluating the remaining conditions for that rule. Record a trace entry with `matched: false` and the `failedCondition` that caused the short-circuit, including the condition's `type` and the `detail` string from the matcher.
3. If all conditions match, the rule wins. The reason is `"rule: {ruleName} (id: {ruleId}, priority: {priority})"`. Stop evaluating further rules.

Disabled rules are excluded from evaluation entirely. They do not appear in the trace.

**Step 3: Default image.** If no rule matched and `input.defaultImageId` is not null, use it. The reason is `"default image"`. The trace contains entries for every enabled rule that was evaluated and failed.

**Step 4: No image.** If no rule matched and no default image is set, the resolver still returns a result, but with a sentinel reason `"no image selected"` and an empty `chosenImageId` of `""`. The caller (the scheduled function) interprets this as "do not upload" and writes an error-class decision to the log.

### Trace output

The `trace` array provides a complete audit trail of the evaluation. It is stored in `users/{uid}/decisions/{autoId}` alongside the chosen image, enabling debugging through the Decision Log UI.

Trace entries are ordered in the same sequence rules were evaluated (priority descending, then updatedAt descending). For the winning rule, `matched` is `true` and `failedCondition` is absent. For non-winning rules, `matched` is `false` and `failedCondition` names the first condition that failed, along with the matcher's `detail` string explaining why.

When an override is active, the trace array is empty because no rules were evaluated.

When the default image is used, the trace contains every enabled rule that was evaluated, all with `matched: false`.

### Location staleness

Location data can become stale if the user's phone has not reported a position update recently. Rather than using outdated coordinates that could produce misleading matches, the resolver treats stale location as unavailable for location-dependent conditions.

The staleness threshold is **120 minutes** (2 hours). This is defined as a constant `LOCATION_STALE_THRESHOLD_MINUTES` in `apps/functions/src/resolver/constants.ts`.

When `signals.location` is non-null but `signals.location.ageMinutes > 120`, the following condition matchers return `{ matched: false, detail: "location stale" }` without evaluating the geometric or geographic check:

- `geofenceCircle`
- `geofencePolygon`
- `country`
- `nearCity`

When `signals.location` is `null`, these same matchers return `{ matched: false, detail: "no location available" }`.

Time-based and weather-based conditions are not affected by location staleness. Weather data has its own caching and freshness rules handled in the signal collection layer.

### Timezone handling

The `timezone` parameter is an IANA timezone string (e.g., `"America/New_York"`) derived from the user's most recent location. If no location is available or the timezone cannot be determined, the caller passes `null` and the resolver treats it as `"UTC"`.

Time-sensitive matchers (`date`, `dateRange`, `monthRange`, `dayOfWeek`, `timeRange`) convert `input.now` to the local timezone before comparison. This ensures that a rule configured for "weekdays" or "after 6 PM" uses the user's local time, not server time.

The `timeOfDay` matcher does not use the timezone directly; it compares `input.now` against `signals.sunrise` and `signals.sunset`, which are already computed for the correct date and location.

### Condition dispatcher

The resolver does not contain matcher logic directly. It delegates to a condition dispatcher in `apps/functions/src/resolver/conditions/index.ts`:

```ts
function evaluateCondition(
  condition: Condition,
  signals: ResolverSignals,
  now: Date,
  timezone: string,
): MatchResult;
```

This function reads `condition.type` and calls the appropriate matcher. If `condition.type` is not recognized (which should be impossible given Zod validation at the data boundary), the dispatcher returns `{ matched: false, detail: "unknown condition type: {type}" }`.

### Caller integration

The resolver is called from three places:

1. **`syncAvatar` (scheduled function).** Assembles signals from location, weather, geocoding, and suncalc. Calls `resolveImage`. Writes the decision to Firestore. If an image was chosen, compares its hash against `slackState.lastUploadedImageHash` and uploads to Slack if different.

2. **`syncNow` (HTTPS function).** Same flow as `syncAvatar` but triggered on demand by an authenticated user. Returns the full `ResolverOutput` in the response body.

3. **`testRule` (HTTPS function).** Takes a single rule (or rule ID to look up). Assembles current signals. Calls `resolveImage` with a `rules` array containing only the rule under test, no override, and no default image. Returns the trace, allowing the UI to show per-condition match status.

In all cases, signal assembly happens outside the resolver. The resolver receives fully-prepared data and returns a decision.

## Alternatives considered

**Rule evaluation with weighted scoring instead of first-match.** Instead of "first matching rule wins," each rule could contribute a score, and the image with the highest total score would be chosen. This is more flexible but much harder to predict and debug. First-match with explicit priorities gives users clear control over precedence and produces simpler trace output.

**Lazy signal collection (fetch signals only when needed).** Instead of pre-fetching all signals before calling the resolver, the resolver could request signals on demand as conditions need them. This would avoid unnecessary API calls when the winning rule only checks time-based conditions. However, it makes the resolver impure (it would need to perform I/O) and complicates testing. Pre-fetching all signals keeps the resolver as a pure function and makes the cost predictable.

**Storing the resolver result in the rule document.** Rather than a separate `decisions` collection, the result could be stamped onto each rule. This conflates configuration data (rules) with runtime data (decisions) and makes it harder to show a historical log. A separate `decisions` collection provides a clean audit trail.

**Parallel condition evaluation within a rule.** Evaluating all conditions in parallel and collecting results before deciding match/no-match would provide a complete trace for every condition. However, AND semantics with short-circuiting is simpler to implement, faster for rules with many conditions, and still provides enough information for debugging (the first failing condition is the most important one). For the `testRule` endpoint where showing all conditions matters, a separate non-short-circuiting evaluation path can be added later.

**Configurable staleness threshold per user or per condition.** Instead of a global 120-minute threshold, each user or each condition instance could specify its own freshness requirement. This adds complexity with little practical benefit for a single-user tool. A single constant is easier to understand and change if needed.

## Open questions

- Should `testRule` use a separate non-short-circuiting evaluation path so the UI can show pass/fail for every condition in one request? The resolver itself always short-circuits, but `testRule` could evaluate all conditions for diagnostic purposes.
- What should happen if two enabled rules have identical priority and identical `updatedAt` timestamps? The current proposal uses `updatedAt` as the tiebreaker, but if those are also equal, the result is technically non-deterministic. Should a third tiebreaker (e.g., `ruleId` alphabetical) be specified?

## Acceptance criteria

- `apps/functions/src/resolver/index.ts` exports a `resolveImage` function matching the signature above, with no side effects and no imports of I/O modules.
- The function handles the four-step cascade correctly: override, rules (sorted by priority then updatedAt), default image, and no-image fallback.
- `apps/functions/src/resolver/index.test.ts` contains 30 or more test cases covering at least:
  - Active override with future expiry wins over all rules.
  - Active override with past expiry is ignored; rules are evaluated.
  - Pinned override (null `expiresAt`) always wins.
  - Rules sorted by priority descending; highest-priority matching rule wins.
  - Priority tie broken by `updatedAt` descending.
  - Rule with empty conditions matches unconditionally.
  - Rule with multiple conditions: all must pass (AND).
  - Rule with multiple conditions: short-circuits on first failing condition.
  - Disabled rules are skipped entirely and do not appear in the trace.
  - No rules match, default image is returned.
  - No rules match, no default image, result has empty `chosenImageId` and reason `"no image selected"`.
  - Only the first matching rule is returned; lower-priority matching rules are not evaluated.
  - Trace contains entries in priority order.
  - Trace entry for a matched rule has `matched: true` and no `failedCondition`.
  - Trace entry for a failed rule has `matched: false` and `failedCondition` with type and detail.
  - Override produces an empty trace.
  - Mix of enabled and disabled rules: disabled rules have no trace entry.
  - All rules disabled: falls through to default image.
  - Single rule with a single condition that matches.
  - Single rule with a single condition that fails.
  - Multiple rules where the first (highest priority) fails and a lower-priority rule matches.
  - Rule with stale location signal: location-dependent conditions fail with "location stale" detail.
  - Rule with null location signal: location-dependent conditions fail with "no location available" detail.
  - Rule mixing time-based and location-based conditions: time condition passes, location condition fails due to staleness.
  - Zero rules (empty array): falls through to default image.
  - Default image is null and no rules match: returns no-image result.
  - Timezone fallback to UTC when `timezone` is null.
  - Override source is included in the reason string.
  - Rule name and ID are included in the reason string for a rule-based decision.
  - Priority values can be negative or zero.
  - Rules with the same image but different conditions are evaluated independently.
- `apps/functions/src/resolver/constants.ts` exports `LOCATION_STALE_THRESHOLD_MINUTES` with a value of 120.
- Coverage for `apps/functions/src/resolver/index.ts` is 95% or above (statements and branches).
- The resolver integrates with the condition dispatcher from [003-condition-model.md](003-condition-model.md) without containing any condition-specific logic itself.
- `syncAvatar`, `syncNow`, and `testRule` all call `resolveImage` and handle the output correctly (writing decisions, returning traces, respecting the no-image sentinel).
- No condition-matching logic exists in the resolver file. All matching is delegated to the condition dispatcher.
