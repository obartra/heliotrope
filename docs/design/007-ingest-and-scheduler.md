# 007 - Ingest and Scheduler

## Context

Heliotrope needs to know where the user is and what conditions are like at that location in order to pick the right avatar. Location data arrives from two sources: an iOS Shortcut that fires on significant location changes, and the browser when the web UI is open. Once location is known, external signals (weather, geocoding, sunrise/sunset) must be fetched, cached, and fed into the resolver. Finally, a scheduled function must run the full evaluation loop periodically, decide whether to upload a new avatar to Slack, and record a decision trace for debugging.

This document covers four Cloud Functions (`syncAvatar`, `ingestLocation`, `syncNow`, `testRule`), the external signal fetching and caching layer, the location ingestion pipeline, and the auth scheme for the `ingestLocation` endpoint.

## Proposal

### `syncAvatar` (scheduled)

File: `apps/functions/src/scheduled/syncAvatar.ts`

Runs on a Cloud Scheduler interval (default every 15 minutes, configurable per user via `profile.scheduler.intervalMinutes`). The function iterates over all users whose `profile/singleton` document has `slack.connected: true` (v1: exactly one user).

Per-user steps:

1. **Read state.** Fetch the user's profile, enabled rules (sorted by priority descending), images metadata, active override (`overrides/active`), and the most recent location document (sorted by `timestamp` descending, limit 1).
2. **Fetch signals.** If a location exists and is not stale (under 2 hours old), call the weather and geocoding signal providers for that lat/lon. Compute sunrise and sunset using `suncalc` from the lat/lon and the current date.
3. **Resolve.** Pass all signals, rules, override, and `defaultImageId` to the resolver (design doc 004). Receive `chosenImageId`, `reason`, and `trace`.
4. **Write decision.** Write a `decisions/{autoId}` document with the full trace, the chosen image, the signals snapshot, and an `uploaded` flag (initially `false`). Trim the `decisions` collection to the 1,000 newest documents.
5. **Upload check.** Compare the chosen image's content hash against `slackState.lastUploadedImageHash`. If they match, set `uploadSkippedReason: "hash-match"` on the decision and stop. If `slackState.lastUploadedAt` is within `profile.scheduler.minSecondsBetweenSlackUploads` seconds of now, set `uploadSkippedReason: "rate-limit"` and stop.
6. **Upload.** Download the image bytes from Storage at `users/{uid}/avatars/{imageId}.png`. Call the Slack client's `uploadAvatar` (design doc 008) with the bytes and the decrypted Slack token. On success, update `slackState/singleton` with the new hash and timestamp, and set `uploaded: true` on the decision document.
7. **Handle Slack 429.** If Slack returns a 429 status, read the `Retry-After` header and log a warning. Do not retry within this invocation. The next scheduled run will attempt the upload again.
8. **Error handling.** If Slack returns any other error, write the error message to `slackState.lastUploadError` with a timestamp. The decision document records `uploaded: false`.

### `ingestLocation` (HTTPS)

File: `apps/functions/src/http/ingestLocation.ts`

Accepts POST requests only. All other methods return 405.

**Auth scheme.** The `Authorization` header carries a bearer token in the format `<uid>:<opaque>`. The function:

1. Splits the token on the first colon to extract `uid` and the opaque portion.
2. Computes SHA-256 of the opaque portion.
3. Reads `users/{uid}/secrets/iosShortcutBearer` via Admin SDK.
4. Compares the computed hash against `bearerHash` using a constant-time comparison (`crypto.timingSafeEqual`).
5. On mismatch or missing document: returns 401 with no body.
6. On match: proceeds with the write and updates `lastUsedAt` on the bearer document.

**Request body** (validated with Zod):

```ts
{
  lat: number; // -90 to 90
  lon: number; // -180 to 180
  accuracy: number | null;
  timestamp: string; // ISO 8601, converted to Firestore Timestamp
  source: 'ios-shortcut';
}
```

**Write flow:**

1. Write a new document at `users/{uid}/locations/{timestamp}` (where `{timestamp}` is the ISO timestamp string from the request body) with the validated fields and a Firestore `Timestamp`.
2. Trim the `locations` collection to the 500 newest documents by querying in descending `timestamp` order, skipping the first 500, and deleting any remaining documents in a batched write.
3. Return 204 with no body.

### `syncNow` (HTTPS, authed)

File: `apps/functions/src/http/syncNow.ts`

Requires a valid Firebase ID token, verified using the `requireAuthedUser` helper (design doc 001). Accepts POST requests only.

Runs the same evaluation and upload flow as `syncAvatar` for the caller's UID. Returns the decision trace as JSON:

```ts
{
  chosenImageId: string
  reason: string
  trace: TraceEntry[]
  uploaded: boolean
  uploadSkippedReason: "hash-match" | "rate-limit" | null
}
```

This endpoint allows the user to trigger an immediate evaluation from the UI (the Dashboard's "Sync now" button) without waiting for the next scheduled run.

### `testRule` (HTTPS, authed)

File: `apps/functions/src/http/testRule.ts`

Requires a valid Firebase ID token. Accepts POST requests only.

**Request body** (one of two shapes, validated with Zod):

- `{ ruleId: string }` to test an existing rule from Firestore.
- `{ rule: Rule }` to test an inline rule object (used by the Rule Editor's "Test against current signals" button before saving).

**Flow:**

1. Fetch the user's latest location and current signals (weather, geocoding, sunrise/sunset).
2. If `ruleId` is provided, read the rule from `users/{uid}/rules/{ruleId}`. If not found, return 404.
3. Evaluate each condition in the rule against the current signals.
4. Return per-condition results:

```ts
{
  conditions: Array<{
    type: string;
    matched: boolean;
    explanation: string; // human-readable reason for match or failure
  }>;
  overallMatch: boolean; // true only if every condition matched
}
```

This endpoint does not write anything to Firestore. It is purely diagnostic.

### External signal providers

All signal providers live under `apps/functions/src/signals/` and follow a consistent pattern: accept lat/lon (and optionally a date), return typed signal data, and cache results in function instance memory.

#### Weather (`signals/weather.ts`)

- **Source:** Open-Meteo API at `https://api.open-meteo.com/v1/forecast`.
- **Query parameters:** `latitude`, `longitude`, `current=precipitation,snowfall,temperature_2m,weather_code`.
- **No API key required.**
- **Cache:** In-memory `Map` keyed by lat/lon rounded to 2 decimal places. TTL: 10 minutes. Cache is per function instance and is cleared on cold start.
- **Response shape** (after Zod validation of the API response):

```ts
{
  precipitationMmPerHour: number;
  snowfallMmPerHour: number;
  temperatureC: number;
  weatherCode: number;
}
```

- **Error handling:** If the API call fails or returns unexpected data, the weather signal is `null`. The resolver treats `null` weather as "condition cannot be evaluated" and the weather condition matcher returns `matched: false` with detail "weather data unavailable."

#### Geocoding (`signals/geocoding.ts`)

- **Source:** Open-Meteo Geocoding API at `https://geocoding-api.open-meteo.com/v1/search`.
- **Query:** Reverse lookup using lat/lon. Returns nearby places with population, country code, and coordinates.
- **No API key required.**
- **Cache:** In-memory `Map` keyed by lat/lon rounded to 1 decimal place. TTL: 1 hour.
- **Response provides two signals:**
  - `country: string | null` (ISO 3166-1 alpha-2 code of the nearest result).
  - `nearbyCities: Array<{ name: string, population: number, distanceKm: number }>` (all results with distance computed via great-circle formula).

- **Error handling:** On failure, both `country` and `nearbyCities` are `null`. Relevant condition matchers return `matched: false` with appropriate detail.

#### Sunrise/sunset (`signals/timeOfDay.ts`)

- **Library:** `suncalc` (npm package).
- **Input:** lat, lon, current date.
- **Output:** `{ sunrise: Date, sunset: Date }`.
- **No caching needed.** The computation is local and fast.

### Location sources

Location arrives from two sources described in the architecture doc (000): an iOS Shortcut posting to `ingestLocation` on significant location changes, and browser geolocation writing directly to Firestore every 5 minutes of active tab time. The bearer token for the iOS Shortcut is generated via the `generateIosShortcutBearer` endpoint (design doc 011).

### Shared utilities

#### Collection trimming

A shared helper `trimCollection(collectionRef, orderByField, keepCount)` handles the pattern of keeping only the N newest documents. It queries in descending order, offsets by `keepCount`, and batch-deletes the rest. Used by `ingestLocation` (500 locations) and `syncAvatar` (1,000 decisions).

#### Signal assembly

A shared function `assembleSignals(uid)` reads the user's latest location and calls all signal providers. It returns the complete `SignalsSnapshot` object used by both `syncAvatar`/`syncNow` and `testRule`. This avoids duplicating the signal-fetching logic across endpoints.

### File layout

The file layout follows the repository structure defined in the architecture doc (000). Each handler has a colocated `*.integration.test.ts` file for emulator-based integration tests. Signal providers live under `apps/functions/src/signals/` with colocated `*.test.ts` unit tests.

## Alternatives considered

**Pull-based location (polling the phone) instead of push-based ingestion.** A pull model would require the phone to expose a server or use a third-party service that relays location. Push from the iOS Shortcut is simpler, works without any intermediate service, and fires only on meaningful location changes, which reduces unnecessary writes.

**Storing external signal responses in Firestore for auditability.** Persisting every weather and geocoding response would create a complete audit trail but would increase Firestore write costs significantly and is unnecessary given that the `decisions` collection already captures a `signalsSnapshot` at evaluation time. The snapshot provides the same debugging value without the ongoing storage cost.

**Using a dedicated job queue (Cloud Tasks) instead of Cloud Scheduler.** Cloud Tasks would allow per-user scheduling with different intervals, retries, and deduplication. For v1 with a single user, Cloud Scheduler with `onSchedule` is simpler and sufficient. If multi-user support requires per-user intervals, Cloud Tasks can be adopted later without changing the evaluation logic.

**WebSocket or server-sent events for real-time location instead of periodic writes.** A persistent connection from the browser would provide continuous location updates. This was rejected because it would keep a Cloud Function instance alive continuously (increasing cost), and 5-minute polling during active tab time is frequent enough for avatar updates that run on a 15-minute cycle.

**Redis or Memorystore for signal caching instead of in-memory Maps.** An external cache would survive cold starts and be shared across function instances. For v1 with a single user and infrequent invocations, in-memory caching is sufficient. The cost of an occasional redundant API call on cold start is negligible for free, keyless APIs.

## Open questions

- What should `testRule` do when the user has no location data at all? Current proposal: return all location-dependent conditions as `matched: false` with explanation "no location data available." An alternative is to accept optional lat/lon in the request body for testing purposes.
- Should `ingestLocation` validate that the timestamp is not in the future? A clock skew tolerance (for example, 5 minutes) might be appropriate.

## Acceptance criteria

- `ingestLocation` accepts a valid POST with a correct bearer token, writes a location document, and returns 204.
- `ingestLocation` rejects requests with an invalid bearer token with 401.
- `ingestLocation` rejects requests with missing or malformed bearer tokens with 401.
- `ingestLocation` rejects non-POST methods with 405.
- `ingestLocation` validates the request body with Zod and returns 400 for invalid payloads.
- `ingestLocation` trims the `locations` collection to the 500 newest documents after each write.
- `syncNow` requires a valid Firebase ID token and returns 401 for unauthenticated requests.
- `syncNow` runs the full evaluation and upload flow and returns the decision trace as JSON.
- `testRule` requires a valid Firebase ID token and returns 401 for unauthenticated requests.
- `testRule` accepts either a `ruleId` or an inline `rule` object in the request body.
- `testRule` returns per-condition match/fail results with human-readable explanations.
- `testRule` does not write any documents to Firestore.
- `syncAvatar` iterates over users with `slack.connected: true` and runs the full evaluation loop.
- `syncAvatar` writes a `decisions/{autoId}` document with trace, chosen image, and signals snapshot.
- `syncAvatar` skips Slack upload when the image hash matches `slackState.lastUploadedImageHash`.
- `syncAvatar` skips Slack upload when within `minSecondsBetweenSlackUploads` of the last upload.
- `syncAvatar` respects Slack 429 responses and logs the `Retry-After` value.
- `syncAvatar` writes errors to `slackState.lastUploadError` on Slack API failures.
- Weather signal provider calls Open-Meteo with correct parameters and caches responses for 10 minutes per lat/lon.
- Geocoding signal provider calls Open-Meteo and caches responses for 1 hour per lat/lon.
- Sunrise/sunset signal provider computes correct values using `suncalc`.
- All signal providers return `null` gracefully on API failure, and condition matchers handle `null` signals by returning `matched: false` with an appropriate explanation.
- Bearer token comparison in `ingestLocation` uses constant-time comparison (`crypto.timingSafeEqual`).
- Emulator integration tests cover all cases defined in design doc 009, section 3 (Integration tests): `ingestLocation` (9 cases), `syncNow` (7 cases), `testRule` (9 cases), and `assembleSignals` (5 cases).
- `syncAvatar` cron logic is tested by invoking the handler manually with a mocked scheduler context.
- All external API calls (Open-Meteo, Slack) are mocked via `vi.spyOn(globalThis, 'fetch')` in tests. No real external calls in CI.
- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm test` passes with all new tests included.
