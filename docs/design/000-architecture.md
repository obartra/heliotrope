# 000 - Architecture

## Context

Slack profile photos are static. Changing them manually is tedious, so they go stale. The goal is a personal tool that keeps a Slack avatar (in the future potentially others as well) in sync with real-world context (time of day, location, weather, holidays, etc.) without any manual intervention. It must run in the cloud so it works when my laptop is closed, and all rules and images must be editable through a web UI so new contexts can be added without touching code or redeploying.

The name "Heliotrope" refers to the flower that turns to face the sun. This one turns to face context.

## Proposal

### System overview

```
  iOS Shortcut ──POST──▶ Cloud Function (ingestLocation)
                                │
                                ▼
                    Firestore users/{uid}/locations
                                ▲
                                │
  Browser UI (Netlify) ──Firebase SDK──▶ users/{uid}/{rules,images,overrides,...}
                                ▲
                                │
            Scheduled Cloud Function (every 15 min, per user)
              │  reads rules + latest location + weather
              │  evaluates rules, picks winning image
              │  diffs hash against last uploaded
              ▼
            Cloud Function (slackUpload) ──▶ Slack users.setPhoto
```

Frontend on Netlify (static Vite + React). All state in Firestore under `users/{uid}/...`. Scheduled evaluation and Slack uploads happen in Firebase Cloud Functions. Images stored in Firebase Storage under `users/{uid}/avatars/`. Location ingested from an iOS Shortcut on my phone, supplemented by browser geolocation when the UI is open.

### Target user

One person in v1 (me). Architect for one user but namespace data so the app can become multi-tenant later without a data migration. Assume email/password Firebase and user-provided Slack token (stored in Firebase for the user and modifiable via settings).

### Tech stack

- Frontend: Vite + React 18 + TypeScript, Firebase JS SDK v10+, Leaflet for map-based geofence editing
- Backend: Firebase Cloud Functions v2, Node 20, TypeScript
- Database: Firestore (native mode, `us-central1` unless told otherwise)
- Storage: Firebase Storage, one bucket, per-user prefix
- Scheduling: Cloud Scheduler via `onSchedule` helper
- Schema validation: Zod, shared between UI and Functions via `packages/schema`
- Testing: Vitest for units, Firebase Emulator Suite for integration, `@firebase/rules-unit-testing` for rules, Storybook + Chromatic for visual, Cypress for E2E
- Package manager: pnpm workspaces
- Monorepo package names: `@heliotrope/web`, `@heliotrope/functions`, `@heliotrope/schema`

### Constraints

- Netlify for the frontend, Firebase for everything else.
- Free tiers must cover this workload comfortably.
- Firestore data paths all under `users/{uid}/...` even in v1.
- Per-user secrets (Slack token, iOS Shortcut bearer hash) stored in Firestore under `users/{uid}/secrets/...` with rules denying client reads. Only Cloud Functions read them via the Admin SDK.
- Global secrets (Firebase Admin service account key, email allowlist) never in the repo. Service account key is not needed for normal operation; email allowlist lives in a Functions secret.
- **No personal identifiers (emails, names, UIDs, coordinates of my home) in the repo.**
- No em dashes anywhere in code comments, docstrings, or README copy. Restructure sentences.
- TypeScript `strict: true` and `noUncheckedIndexedAccess: true`.
- No `any`. No `@ts-ignore`. `@ts-expect-error` is allowed only with an accompanying comment explaining the specific reason and a link to a tracking issue if temporary.

### Development methodology

This project follows a document-driven approach with strong automated quality gates. Implementation is preceded by a design doc, and design docs are reviewed before any code is written.

**Design docs**

Design docs live in `docs/design/` and are numbered. Expected set:

- `000-architecture.md` overall system, derived from this spec
- `001-auth-and-allowlist.md` email/password auth, signup allowlist enforcement, per-user data isolation
- `002-firestore-schema.md` collection layout, indexes, migration policy
- `003-condition-model.md` the tagged union and how new types are added
- `004-resolver.md` pure function, priority rules, staleness handling
- `005-image-library.md` upload flow, validation, Storage layout
- `006-rule-editor-ui.md` editor structure, condition editor patterns, Leaflet integration
- `007-ingest-and-scheduler.md` Cloud Functions, triggers, caching
- `008-slack-client.md` per-user token storage, hash dedup, rate limits
- `009-testing-strategy.md` unit, integration, visual, e2e
- `010-deployment.md` Netlify + Firebase, secrets, environments
- `011-settings-ui.md` per-user token management, bearer generation, account settings

Each design doc follows this template:

1. **Context.** Why this exists, what problem it solves.
2. **Proposal.** The chosen approach, with enough detail to implement from.
3. **Alternatives considered.** Options rejected and why.
4. **Open questions.** What needs to be decided before implementing.
5. **Acceptance criteria.** What "done" looks like, including tests.

**Workflow per milestone**

1. Write or update the relevant design doc. Post it for review.
2. Wait for explicit approval from me in a chat thread before writing implementation code.
3. Implement against the design doc. The PR description references `docs/design/NNN-*.md`.
4. Tests cover every branch claimed by the design doc.
5. Update the design doc with any deviations discovered during implementation.

Every PR description includes a "Design doc" field linking to the relevant file.

**CLAUDE.md**

A `CLAUDE.md` lives at the repo root and is maintained actively. Claude Code reads it at the start of every session, so it is the operational contract for all AI-assisted work on this repo. It contains:

- Project overview in one paragraph, with a link to `docs/design/000-architecture.md`
- Critical rules: no em dashes in any written content, no personal data in the repo (emails, UIDs, home coordinates), design-doc-first workflow, no `any` types
- Commands: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm emulators`, `pnpm storybook`, `pnpm cypress`
- File organization conventions: where new condition types go (`functions/src/resolver/conditions/` + `web/src/components/ConditionEditor/` + a test file and a story), where new Functions go, where new pages go
- Testing requirements before a PR is ready: typecheck, lint, unit, rules, integration, Storybook build, affected E2E
- Debugging recipes: how to inspect `decisions/*` for why a given image was chosen, how to check `slackState/singleton` after a failed upload, how to replay a specific signal bundle through the resolver locally, how to reset a user's Slack token in emulator
- A short "what not to do" list: don't commit secrets or emails, don't bypass the design-doc gate, don't skip rules tests when changing Firestore paths, don't add `any` without a comment explaining why, don't echo user secrets back in API responses or logs
- Links to every design doc in `docs/design/`

Keep it under 300 lines. If it grows beyond that, move detail into a design doc and link it.

### Tooling

**Language and type safety**

- TypeScript with `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
- Zod schemas in `packages/schema` are the source of truth. TypeScript types derive via `z.infer`.
- External data (HTTP responses, Firestore docs, URL params) is typed `unknown` at the boundary and narrowed through Zod before use.

**Linting and formatting**

- ESLint with `@typescript-eslint/recommended-type-checked` and `stylistic-type-checked`.
- `eslint-plugin-import` with sorted imports enforced.
- `eslint-plugin-react` and `eslint-plugin-react-hooks` on `apps/web`.
- Custom ESLint rule that flags em dashes in string literals, JSX text, and comments. Write it as a small local plugin in `tooling/eslint-plugin-heliotrope/`.
- Prettier with project config, applied on commit.

**Pre-commit hooks**

- Husky + lint-staged.
- On commit: typecheck affected packages, lint + format changed files, run affected unit tests.
- Commits blocked on failure. `--no-verify` requires the commit message to start with `chore(skip-verify):` and a reason; CI will still enforce everything on the PR.

**Continuous integration (GitHub Actions)**

On every PR:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` across the monorepo
3. `pnpm lint`
4. `pnpm test` (unit + rules + integration via Firebase Emulator)
5. `pnpm build` for each app
6. `pnpm storybook:build` then Chromatic runs against the build
7. Netlify deploy preview spins up automatically
8. Cypress runs against the deploy preview with Firebase Emulator as the backend

Merge blocked unless all checks green and Chromatic has no unreviewed visual changes.

### Repository layout

```
heliotrope/
  pnpm-workspace.yaml
  apps/
    web/                                # Vite + React on Netlify
      src/
        pages/
          SignIn.tsx
          Dashboard.tsx
          Rules.tsx
          RuleEditor.tsx
          Images.tsx
          Settings.tsx
          Log.tsx
        components/
          ConditionEditor/              # one component per condition type
            DateCondition.tsx
            DateRangeCondition.tsx
            DayOfWeekCondition.tsx
            TimeRangeCondition.tsx
            TimeOfDayCondition.tsx
            GeofenceCircleCondition.tsx # Leaflet map
            GeofencePolygonCondition.tsx
            CountryCondition.tsx
            WeatherCondition.tsx
            NearCityCondition.tsx
          ImageUploader.tsx
          RuleCard.tsx
          OverridePicker.tsx
          SignalsPanel.tsx
          SlackTokenInput.tsx
          IosShortcutBearerPanel.tsx
        lib/
          firebase.ts
          auth.ts
          firestore.ts
          storage.ts
      netlify.toml
    functions/
      src/
        index.ts
        scheduled/syncAvatar.ts
        http/
          ingestLocation.ts
          syncNow.ts
          testRule.ts
          generateIosShortcutBearer.ts
          setSlackToken.ts              # validates token via Slack auth.test, then stores
        auth/
          beforeUserCreated.ts          # allowlist gate
        resolver/
          index.ts
          conditions/
            date.ts
            dateRange.ts
            dayOfWeek.ts
            timeRange.ts
            timeOfDay.ts
            geofenceCircle.ts
            geofencePolygon.ts
            country.ts
            weather.ts
            nearCity.ts
        signals/
          weather.ts
          geocoding.ts                  # Open-Meteo, returns country + nearby cities
          timeOfDay.ts
        slack/
          client.ts
          hash.ts
        firestore/
          collections.ts
  packages/
    schema/
      src/
        image.ts
        rule.ts
        condition.ts
        override.ts
        location.ts
        decision.ts
  tooling/
    eslint-plugin-heliotrope/             # custom ESLint rules (em dash guard, etc.)
  docs/
    design/
      000-architecture.md
      001-auth-and-allowlist.md
      002-firestore-schema.md
      003-condition-model.md
      004-resolver.md
      005-image-library.md
      006-rule-editor-ui.md
      007-ingest-and-scheduler.md
      008-slack-client.md
      009-testing-strategy.md
      010-deployment.md
      011-settings-ui.md
  .github/
    workflows/
      ci.yml                              # typecheck, lint, test, build, chromatic
      cypress.yml                         # runs against Netlify deploy preview
      pr-template.md
  .storybook/
    main.ts
    preview.ts
  cypress/
    e2e/
    fixtures/
    support/
  CLAUDE.md                               # operational contract for AI-assisted work
  firestore.rules
  firestore.indexes.json
  storage.rules
  firebase.json
  chromatic.config.json
  .eslintrc.cjs
  .prettierrc
  .gitignore                              # excludes service account keys, seeds, etc.
  README.md
```

Every component under `apps/web/src/components/` and every page under `apps/web/src/pages/` has a colocated `*.stories.tsx` file next to it. HTTP Cloud Function handlers have colocated `*.integration.test.ts` files for emulator-based integration tests. Resolver logic, condition matchers, and signal providers have colocated `*.test.ts` unit test files.

### Auth: email/password with allowlist, per-user isolation

**Provider**

Firebase Auth with email/password provider. Google sign-in is not used.

**Signup gate**

An Auth blocking function `beforeUserCreated` runs on every signup attempt. It reads an allowlist from the Functions secret `ALLOWED_SIGNUP_EMAILS` (JSON array of emails) and rejects creation of any user whose email is not on the list. Rejection returns `HttpsError("permission-denied", "...")` which the UI renders as "This email is not allowed to sign up."

The allowlist is the only global access control. No custom claims, no admin grant script, no service account key in daily use.

**Firestore rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // Main per-user data: owner can read/write.
    match /users/{uid}/profile/{doc} { allow read, write: if isOwner(uid); }
    match /users/{uid}/images/{doc} { allow read, write: if isOwner(uid); }
    match /users/{uid}/rules/{doc} { allow read, write: if isOwner(uid); }
    match /users/{uid}/overrides/{doc} { allow read, write: if isOwner(uid); }
    match /users/{uid}/locations/{doc} {
      allow read: if isOwner(uid);
      allow write: if isOwner(uid);  // browser geolocation writes directly
    }
    match /users/{uid}/decisions/{doc} {
      allow read: if isOwner(uid);
      allow write: if false;          // only Functions write
    }
    match /users/{uid}/slackState/{doc} {
      allow read: if isOwner(uid);
      allow write: if false;          // only Functions write
    }

    // Secrets collection: nobody reads or writes from the client.
    // Functions use Admin SDK and bypass these rules.
    match /users/{uid}/secrets/{doc} {
      allow read: if false;
      allow write: if false;
    }
  }
}
```

**Storage rules** mirror the owner pattern for `users/{uid}/avatars/...`.

**Per-user secrets: Slack token**

Stored at `users/{uid}/secrets/slack`:

```ts
{
  tokenCipher: string; // AES-GCM encrypted with a KMS key or Functions-managed key
  tokenHash: string; // SHA-256 of plaintext, for equality checks without decrypting
  slackUserId: string; // from Slack auth.test
  slackTeamId: string; // from Slack auth.test
  updatedAt: Timestamp;
  lastValidatedAt: Timestamp;
}
```

Write flow:

1. User enters token in the Settings UI.
2. UI calls `POST /setSlackToken` HTTPS Function with the token in the request body over HTTPS.
3. Function verifies ID token, calls Slack `auth.test` with the token to confirm it works and to get `user_id` and `team_id`.
4. Function encrypts the token with a server-side key (derived from a Functions secret `TOKEN_ENCRYPTION_KEY`), writes the doc.
5. Response is `{ ok: true, slackTeamId, slackUserId }`. The plaintext token is never sent back.

Read flow: only `syncAvatar` reads the doc via Admin SDK, decrypts, uses. Never logged.

UI shows "Slack connected to workspace X as user Y, last validated T." It never echoes the token back.

**Per-user secrets: iOS Shortcut bearer**

Stored at `users/{uid}/secrets/iosShortcutBearer`:

```ts
{
  bearerHash: string; // SHA-256 of the opaque portion
  createdAt: Timestamp;
  lastUsedAt: Timestamp | null;
}
```

Generation flow:

1. User clicks "Generate new bearer" in Settings.
2. UI calls `POST /generateIosShortcutBearer` HTTPS Function.
3. Function generates `<uid>:<32-byte-random-base64url>`, hashes the opaque portion, writes the doc, returns the full bearer to the UI **once**.
4. UI displays the bearer in a copy-only field with "This will not be shown again."
5. User pastes into the iOS Shortcut's Authorization header.

Ingest flow:

1. iOS Shortcut POSTs with `Authorization: Bearer <uid>:<opaque>`.
2. `ingestLocation` parses out the uid, hashes the opaque portion, fetches `users/{uid}/secrets/iosShortcutBearer`, compares hashes in constant time.
3. On match: write the location doc, update `lastUsedAt`. On mismatch: 401.

Regeneration invalidates the old bearer. No rotation mechanism beyond regenerate-and-repaste for v1.

**HTTPS Function auth helper**

`requireAuthedUser(req): Promise<{ uid: string, email: string }>` verifies the Firebase ID token, returns the uid. No claim check; just presence of a valid token.

### Firestore schema

All data under `users/{uid}/...`. Documents validated with Zod schemas from `packages/schema`.

**`users/{uid}/profile/singleton`**

```ts
{
  displayName: string;
  email: string;
  slack: {
    connected: boolean; // true if a valid token is stored
    teamId: string | null; // cached from last auth.test
    userId: string | null;
    teamName: string | null;
  }
  createdAt: Timestamp;
  scheduler: {
    intervalMinutes: number; // default 15
    minSecondsBetweenSlackUploads: number; // default 300
  }
  defaultImageId: string | null;
}
```

The `slack.connected` flag is what the scheduled function checks to decide whether to process this user. Secret material lives in the separate `secrets` collection (see Auth section above).

**`users/{uid}/images/{imageId}`**

First-class entity, referenced by rules via `imageId`. Filename is display-only.

```ts
{
  id: string                             // uuid
  filename: string
  displayName: string
  storagePath: string                    // "users/{uid}/avatars/{imageId}.png"
  contentType: string
  bytes: number
  width: number
  height: number
  tags: string[]                         // freeform, used for UI grouping
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**`users/{uid}/rules/{ruleId}`**

```ts
{
  id: string
  name: string
  enabled: boolean
  priority: number                       // higher wins, integer, UI spaces in 10s
  imageId: string
  conditions: Condition[]                // ANDed, empty means always matches
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**`users/{uid}/overrides/active`**

```ts
{
  imageId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  source: 'ui' | 'ios-shortcut';
}
```

**`users/{uid}/locations/{timestamp}`**

```ts
{
  lat: number;
  lon: number;
  accuracy: number | null;
  timestamp: Timestamp;
  source: 'ios-shortcut' | 'browser';
}
```

Indexed descending on `timestamp`. Trim to 500 newest on each write.

**`users/{uid}/decisions/{autoId}`**

```ts
{
  at: Timestamp;
  chosenImageId: string;
  reason: string;
  trace: Array<{
    ruleId: string | null;
    ruleName: string | null;
    matched: boolean;
    failedCondition?: { type: string; detail: string };
  }>;
  uploaded: boolean;
  uploadSkippedReason: 'hash-match' | 'rate-limit' | null;
  signalsSnapshot: SignalsSnapshot;
}
```

Keep 1,000 newest.

**`users/{uid}/slackState/singleton`**

```ts
{
  lastUploadedImageHash: string | null
  lastUploadedAt: Timestamp | null
  lastUploadError: { at: Timestamp, message: string } | null
}
```

### The condition model

A `Condition` is a tagged union. Each variant has an independent matcher function and an independent UI editor component. Adding a new condition is a matter of writing a new matcher + editor.

```ts
type Condition =
  | {
      type: 'date';
      monthDay: string; // "MM-DD"
      windowDaysBefore?: number;
      windowDaysAfter?: number;
    }
  | { type: 'dateRange'; fromISO: string; toISO: string } // inclusive
  | { type: 'monthRange'; fromMonth: number; toMonth: number } // 1-12, supports wrap
  | { type: 'dayOfWeek'; days: Array<1 | 2 | 3 | 4 | 5 | 6 | 7> } // ISO, 1=Mon
  | { type: 'timeRange'; fromLocal: string; toLocal: string } // "HH:mm", supports midnight wrap
  | { type: 'timeOfDay'; value: 'day' | 'night' } // relative to sunrise/sunset
  | { type: 'geofenceCircle'; center: [number, number]; radiusMeters: number }
  | { type: 'geofencePolygon'; points: Array<[number, number]> }
  | { type: 'country'; codes: string[] } // ISO 3166-1 alpha-2, any match
  | {
      type: 'weather';
      field: 'precipitationMmPerHour' | 'snowfallMmPerHour' | 'temperatureC' | 'weatherCode';
      op: '>' | '<' | '>=' | '<=' | '==';
      value: number;
    }
  | { type: 'nearCity'; minPopulation: number; maxDistanceKm: number };
```

Conditions within a rule combine with AND. For OR, create duplicate rules. NOT is not supported in v1.

**`nearCity` details.** Uses Open-Meteo's geocoding API (`https://geocoding-api.open-meteo.com/v1/search`) which is free and keyless. The signal collector queries the endpoint reverse-style using `reverse=true` and the current lat/lon, receiving nearby places with their populations and coordinates. The matcher returns true if any returned place has `population >= minPopulation` and lies within `maxDistanceKm` great-circle distance. Cache the response per lat/lon for 1 hour.

### Rule evaluation

Pure function:

```ts
function resolveImage(input: {
  now: Date;
  timezone: string | null; // derived from location, falls back to UTC
  signals: {
    location: { lat: number; lon: number; ageMinutes: number } | null;
    weather: WeatherFix | null;
    sunrise: Date;
    sunset: Date;
    country: string | null;
    nearbyCities: Array<{ name: string; population: number; distanceKm: number }>;
  };
  override: Override | null;
  rules: Rule[];
  defaultImageId: string | null;
}): { chosenImageId: string; reason: string; trace: TraceEntry[] };
```

Order:

1. **Active override.** If set and not expired, return it. No rules evaluated.
2. **Rules.** Sort enabled rules by `priority` descending, tie-break by `updatedAt` descending. For each rule, evaluate all conditions with AND. First rule where every condition matches wins.
3. **Default image.** If no rule matched and `defaultImageId` is set, use it.
4. **Nothing.** Log an error decision, do not upload.

**Location staleness.** If location is older than 2 hours, condition matchers that need location (`geofenceCircle`, `geofencePolygon`, `country`, `nearCity`) return `matched: false` with detail "location stale."

### Image library

Upload constraints:

- PNG or JPEG, up to 2 MB (Slack caps at 1 MB, warn in UI but let Slack's error surface).
- Min 128x128, max 1024x1024. Square recommended, warn if not.
- Upload writes bytes to `users/{uid}/avatars/{imageId}.png`, writes metadata doc.
- Delete: confirm if rules reference the image. Offer to delete referencing rules or reassign them.
- Rename (displayName only): updates doc, leaves file intact.
- Replace bytes: new upload to same path, bumps `updatedAt`. Next scheduled run picks up the new hash.

Library view groups by tags. Suggested tags: "activity", "location", "holiday", "weather", "event".

### External signals

**Weather (Open-Meteo).** Endpoint `https://api.open-meteo.com/v1/forecast` with `current=precipitation,snowfall,temperature_2m,weather_code` plus lat/lon. No key. Cache per lat/lon for 10 minutes in Function memory.

**Geocoding (Open-Meteo).** Endpoint `https://geocoding-api.open-meteo.com/v1/search`. Reverse lookup from lat/lon returns nearby places with population, country code, admin levels, and coordinates. Single call per location tick provides both `country` and `nearbyCities` signals. Cache 1 hour.

**Sunrise/sunset.** Compute via `suncalc` from lat/lon and date.

### Location sources

**Primary: iOS Shortcut**

- Trigger: "significant location change".
- Action: POST to `ingestLocation` with `Authorization: Bearer <uid>:<opaque>` and body `{ lat, lon, accuracy, timestamp, source: "ios-shortcut" }`.
- Function parses uid from the bearer, hashes the opaque portion, compares against `users/{uid}/secrets/iosShortcutBearer` in constant time. On match: writes `users/{uid}/locations/{timestamp}`. On mismatch: 401.

**Secondary: browser geolocation**

When UI is open, every 5 minutes of active tab time, read `navigator.geolocation.getCurrentPosition` and write directly to Firestore under the authed user's locations collection. Security rules permit this since the path is under `users/{uid}/` and the user is the owner.

### Cloud Functions

**`syncAvatar` (scheduled)**

Every N minutes, iterate over all users with `slack.connected: true` in their profile (v1: exactly one). Per user:

1. Read profile, rules, images metadata, active override, latest location.
2. Fetch weather + geocoding for location, compute sunrise/sunset.
3. Resolve image via the resolver.
4. Write a `decisions/{autoId}` entry with full trace.
5. If winning image hash matches `slackState.lastUploadedImageHash`, skip. If within `minSecondsBetweenSlackUploads`, skip. Else download bytes from Storage, call Slack `users.setPhoto`, update `slackState`.
6. On Slack 429, respect `Retry-After`.

**`ingestLocation` (HTTPS)**

- POST only.
- Bearer token auth (`<uid>:<opaque>` format, validated against per-user hash in Firestore).
- Writes location doc, trims collection to 500 newest.
- Returns 204.

**`syncNow` (HTTPS, authed)**

- Requires Firebase ID token (valid authed user).
- Runs the same flow as `syncAvatar` for the caller's uid.
- Returns the decision trace.

**`testRule` (HTTPS, authed)**

- Takes a rule (or rule ID) in the body.
- Evaluates each condition against current signals.
- Returns per-condition match/fail with explanation.
- Does not write anything.

### UI requirements

React SPA. Routes:

- `/` Dashboard (current state, override controls, signals panel)
- `/rules` Rules list with drag-to-reorder, enable/disable toggles, add/edit/delete
- `/rules/:id` Rule editor
- `/images` Image library (upload, rename, tag, delete, replace bytes)
- `/settings` Account settings, Slack token management, iOS Shortcut bearer generation
- `/log` Decision log with filters by rule, by image, by reason

**Rule editor**

- Name (text)
- Enabled (toggle)
- Priority (number with up/down nudges in steps of 10)
- Image (picker with thumbnails from library, grouped by tag)
- Conditions list: "Add condition" opens a dropdown of condition types, each with its own form.
- Geofence editors use Leaflet: circle = click to place center, drag radius or numeric input; polygon = click to drop points, double-click to finish, drag to adjust.
- "Test against current signals" button calls `testRule`, shows each condition's match status with explanation.

**Override picker (Dashboard)**

Grouped by image tag. TTL buttons `1h`, `4h`, `today`, `pin`. Apply button. Clear link when active.

**Live updates**

Firestore snapshot listeners on `decisions` (most recent), `overrides/active`, `slackState/singleton`.

**Styling**

Plain CSS modules or vanilla CSS. No Tailwind, no component library. Leaflet CSS included separately. Bundle under 200 KB gzipped.

### Seed data

On first sign-in, if the user has no images and no rules, offer to run a seed import.

**Images**: upload the 26 PNGs placed in `seed/avatars/`. Filenames preserved. Tags inferred from filename.

**Rules** (priorities spaced by 100, all enabled):

| Priority | Name                | Image                 | Conditions                                               |
| -------- | ------------------- | --------------------- | -------------------------------------------------------- |
| 1000     | New Year            | newyears.png          | `date 01-01, windowDaysBefore 1, windowDaysAfter 1`      |
| 990      | Black History Month | black-history.png     | `monthRange 2-2`                                         |
| 980      | St Patrick's Day    | st-pattricks.png      | `date 03-17`                                             |
| 970      | Cinco de Mayo       | cinco-de-mayo.png     | `date 05-05`                                             |
| 960      | Independence Day    | 4th-july.png          | `date 07-04`                                             |
| 900      | SF office           | office.png            | `geofenceCircle center [37.7886, -122.4067] radius 200m` |
| 700      | Dog walk at night   | dog-walk-night.png    | `timeOfDay night` (I'll add geofence myself)             |
| 690      | Dog walk in daytime | dog-walk-day.png      | `timeOfDay day` (I'll add geofence myself)               |
| 500      | Heavy rain          | rainy-day.png         | `weather precipitationMmPerHour >= 2`                    |
| 490      | Snow                | winter wonderland.png | `weather snowfallMmPerHour >= 1`                         |
| 300      | Brazil              | brazil.png            | `country [BR]`                                           |
| 100      | City fallback       | cityscape.png         | `nearCity minPopulation 100000 maxDistanceKm 10`         |

`default.png` becomes `defaultImageId`. Renaissance Faire, diving, hiking, yoga, weight lifting, hang-gliding, cooking, coffeeshop, beach, jungle are uploaded but have no rules, so they're manual-override-only from the start.

The SF office coordinate (37.7886, -122.4067) is approximate for 150 Post St. Do not commit this to the repo as a named office address; it only appears as seed data loaded into Firestore at runtime, never in tracked source files. Put the seed data in `seed/rules.seed.json` and have `.gitignore` exclude `seed/rules.seed.json` so the user creates it locally from a template `seed/rules.seed.example.json` that has placeholder coordinates.

### Secrets

Set via `firebase functions:secrets:set`:

- `ALLOWED_SIGNUP_EMAILS` (JSON array of allowed email addresses)
- `TOKEN_ENCRYPTION_KEY` (used to encrypt per-user Slack tokens at rest)

Stored locally, not in repo:

- Firebase Admin service account key (only needed for initial Firebase setup, not daily operation)

`.gitignore` must exclude: `*serviceAccount*.json`, `seed/rules.seed.json`, `.env*`.

### Testing

Every milestone ships with the tests that cover its acceptance criteria. CI fails if coverage for modified packages drops below the targets below.

**Unit tests (Vitest)**

- `packages/schema`: Zod schemas round-trip correctly and reject invalid input.
- `apps/functions/src/resolver/conditions/*.test.ts`: each matcher. Edge cases include month range wrapping year, time range crossing midnight, polygon edges, antimeridian, DST transitions, stale location fallback.
- `apps/functions/src/resolver/index.test.ts`: 30+ cases covering priority, empty conditions, disabled rules, override precedence, default fallthrough.
- `apps/functions/src/slack/hash.ts`: hash stability across image encodings.
- `apps/web/src/lib/**`: pure helpers.

**Firestore and Storage rules tests** (`@firebase/rules-unit-testing`)

- Owner allowed, non-owner denied, unauthenticated denied, cross-user writes denied.
- Storage paths enforce the same user isolation.

**Integration tests (Firebase Emulator Suite)**

Cloud Function handlers are tested with real Firestore (emulator) but mocked external APIs via `vi.spyOn(globalThis, 'fetch')`. Each handler has a colocated `*.integration.test.ts` file. Full test case tables are in design doc 009, section 3. Summary:

- `ingestLocation`: bearer auth (valid, invalid, missing, malformed), body validation, location writes, collection trimming, `lastUsedAt` update (9 cases).
- `syncNow`: full resolver pipeline, default fallback, override handling, no-location fallback, auth (7 cases).
- `testRule`: ruleId lookup, inline rule, not-found, no-location, signals snapshot, auth (9 cases).
- `assembleSignals`: full signals, no-location fallback, individual API failure resilience (5 cases).
- `syncAvatar` cron logic tested by invoking the handler manually with a mocked scheduler context.

**Component tests and visual regression (Storybook + Chromatic)**

- Every component in `apps/web/src/components/` and every page in `apps/web/src/pages/` has at least one Storybook story.
- Stories cover empty, populated, loading, and error states.
- Condition editors have stories for each condition type plus at least one invalid-input story.
- Storybook a11y addon enabled. Axe runs against every story. Serious or critical violations fail CI.
- Chromatic runs on every PR and blocks merge on unreviewed visual changes.

**End-to-end (Cypress)**

- Smoke test: sign in with an allowed email, upload an image, create a rule with a geofence and a weather condition, apply an override, observe decision log update live.
- Rule editor happy path for each condition type.
- Override TTL expiry (with time manipulation).
- Image library delete with rule reference warning.
- Network to Slack and Open-Meteo intercepted and stubbed via `cy.intercept`. No real external calls.
- Runs against Netlify's deploy preview with the Firebase Emulator as the backend in CI.

**Mocking boundary**

- `vi.spyOn(globalThis, 'fetch')` mocks all external HTTP calls (Open-Meteo weather, Open-Meteo geocoding, Slack) in unit and integration tests. Firebase Admin Auth is mocked via `vi.mock('firebase-admin/auth')` for handler tests using `requireAuthedUser`.
- Cypress uses `cy.intercept` for all external API calls.
- No real Slack, Open-Meteo, or ipapi calls in CI, ever.

**Coverage targets**

- Per-package target: 85% statements, 80% branches.
- `packages/schema`: 100%.
- Resolver and condition matchers: 95%+.
- Firestore and Storage rules: 100% of documented policies covered by an allow and a deny case.

### Implementation order

Each numbered milestone begins by writing or updating the relevant design doc in `docs/design/` and getting it approved in chat before any implementation code is written.

1. **Scaffold + methodology.** Monorepo, tsconfigs, Vite + React on Netlify, Firebase init, emulator launch, `.gitignore` with all exclusions, ESLint (with the em-dash custom rule) + Prettier + Husky + lint-staged, GitHub Actions CI, CLAUDE.md skeleton, `docs/design/000-architecture.md` summarizing this spec, empty placeholders for design docs 001-011. Acceptance: `pnpm dev` runs, `pnpm test` passes on empty suites, CI passes on an empty PR, Chromatic project linked but no stories yet.

2. **Auth with allowlist** (design doc: `001`). Sign-in flow, `beforeUserCreated` blocking function checking `ALLOWED_SIGNUP_EMAILS`, Firestore and Storage rules tests green. Acceptance: allowed email signs in successfully, disallowed email is rejected.

3. **Schemas and rules** (design doc: `002`). Zod in `packages/schema`, Firestore + Storage rules, full rules test matrix, coverage at 100% for schemas.

4. **Resolver + condition matchers** (design docs: `003` and `004`). Pure functions + full test suite. 30+ resolver tests, each condition type independently tested. Coverage 95%+ on this code.

5. **Storybook + Chromatic baseline** (part of design doc `009`). Storybook configured, Chromatic linked to the repo, first stories for the scaffolded layout committed, a11y addon enabled, CI enforces Chromatic review. Acceptance: a trivial visual change to a scaffolded component shows up as a Chromatic diff on a PR.

6. **Image library UI** (design doc: `005`). Upload, list, rename, delete with rule-reference warning, tag. Stories for each state. Cypress E2E covers upload and delete.

7. **Rule editor UI** (design doc: `006`). All condition editors including Leaflet map pickers. Stories per condition type, including invalid states. Cypress E2E creates a rule with three conditions.

8. **Functions: ingestLocation, syncNow, testRule** (design doc: `007`). Emulator integration tests.

9. **Settings UI** (design doc: `011`). Slack token input and validation, iOS Shortcut bearer generation, account settings. Stories + Cypress E2E for token management flow. Acceptance: user can store a Slack token and generate a bearer via the Settings page.

10. **Scheduled syncAvatar + Slack client** (design docs: `007` and `008`). Weather + geocoding, decision log, hash dedup, rate limit handling. Acceptance: manual emulator trigger uploads the avatar exactly once.

11. **Dashboard UI.** Current state, override picker, signals panel, live updates via snapshot listeners. Stories + Cypress E2E for applying and clearing overrides.

12. **Seed import.** Script + UI flow that uploads the 26 PNGs and installs the starter rule set from a local template the user fills in.

13. **iOS Shortcut walkthrough.** README section with troubleshooting.

14. **Deploy** (design doc: `010`). Netlify production build, Firebase Functions deploy, Cloud Scheduler job, production secrets set. Acceptance: laptop closed, phone moves, avatar updates in real Slack.

Ship 1 through 4 before anything else. Design docs 000-004 must exist and be approved before any code in those areas lands beyond the scaffold milestone.

### Non-goals for v1

- Multi-user signup. Single user gated by email allowlist.
- Slack OAuth flow. Users paste tokens manually via Settings UI.
- NOT / OR condition combinators. AND only within a rule.
- Mobile app. iOS Shortcut is enough.
- Automatic activity detection (HealthKit, calendar).
- Image generation.
- Rule templates or sharing rules between users.

### Human-only prerequisites

1. Create Firebase project, enable services, run `firebase init` locally.
2. Generate a service account key from the Firebase console, save it outside the repo.
3. Create Slack app, grant `users.profile:read` and `users.profile:write` user scopes, install to workspace, copy token.
4. Create the Netlify site, wire to repo, set env vars.
5. Sign into the deployed (or local) app using an email on the allowlist.
6. Enter the Slack token via the Settings UI. Generate an iOS Shortcut bearer via the Settings UI.
7. Fill in `seed/rules.seed.json` from the example template with actual coordinates for any personal geofences.
8. Create the iOS Shortcut (README walks through it).
9. Run the seed import from the UI.

### Deliverables

- Working monorepo matching the layout above.
- `CLAUDE.md` at the repo root, maintained and current.
- Full `docs/design/` set (000-011) with at least the skeleton sections for any doc whose milestone has not yet shipped, and complete content for shipped milestones.
- `README.md` covering Firebase setup, Netlify setup, Slack app creation, iOS Shortcut walkthrough, local dev with emulators, deploy steps, troubleshooting.
- Storybook deployed via Chromatic, linked from the README.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm cypress:run` all pass.
- Coverage reports meeting the targets in the Testing section.
- `CHANGELOG.md` updated per milestone, referencing the relevant design doc.

## Alternatives considered

**Cron on a VPS instead of Firebase Cloud Functions.** A dedicated server would simplify scheduling but adds ops burden (uptime monitoring, patching, SSH access). Firebase Functions with Cloud Scheduler stay within the managed Firebase ecosystem and fit within free tier limits.

**Supabase instead of Firebase.** Supabase offers Postgres (more flexible querying) and built-in auth. However, Firebase's Firestore security rules, Cloud Functions, and Storage integration form a tighter package for this use case. Firestore's real-time listeners also simplify the live-update requirement on the dashboard.

**Tailwind or a component library for styling.** Rejected to keep the bundle small (under 200 KB gzipped) and avoid learning-curve overhead for a single-user tool. Plain CSS modules are sufficient for the scope.

**Custom claims for access control instead of email allowlist.** Custom claims require a service account key and an admin grant script in daily use. The allowlist approach is simpler: a single Functions secret controls who can sign up, and Firestore rules handle per-user isolation purely via `request.auth.uid` matching. No claims to set, no grant script to run.

**Shared Slack token as a Functions secret instead of per-user encrypted storage.** Storing the token as a Functions secret is simpler but prevents the Settings UI from managing it and blocks the path to multi-tenant support. Per-user encrypted storage in Firestore allows token rotation via the UI and namespaces cleanly.

**Mapping secret for iOS Shortcut bearer instead of embedded uid format.** A `bearer-to-uid` mapping secret works for one user but does not scale and requires secret rotation to add users. The `<uid>:<opaque>` format is self-describing and validated against per-user Firestore docs.

## Open questions

- Firebase region preference (default `us-central1`)?
- TTL semantics for override "today": local midnight in the user's current timezone, or a 12-hour rolling window?
- Image upload constraints: auto-resize uploads over 1024x1024, or just warn?
- Should `testRule` work against last known location regardless of age, or only fresh?
- Should the UI show any indicator when the user's email is on the allowlist vs. just letting sign-in succeed/fail?

## Acceptance criteria

- This document accurately describes the overall system architecture
- All sections are represented: goal, target user, auth model (allowlist + per-user isolation), data model (full Firestore schemas), condition model (tagged union with all 11 types), resolver (pure function with priority/override/default fallthrough), Cloud Functions (syncAvatar, ingestLocation, syncNow, testRule, setSlackToken, generateIosShortcutBearer, beforeUserCreated), external signals, location sources, UI routes and requirements, tooling and CI, testing strategy with coverage targets, implementation order, non-goals, prerequisites, and deliverables
- No internal contradictions: auth uses allowlist (not custom claims), Slack token is per-user in Firestore (not a shared Functions secret), iOS Shortcut bearer uses embedded `<uid>:<opaque>` format (not a mapping secret), syncAvatar filters by `slack.connected` (not a custom claim), syncNow requires a valid ID token (not a claim check)
- The document follows the design doc template (Context, Proposal, Alternatives considered, Open questions, Acceptance criteria)
- Design docs 001-011 are listed with their scope, and the implementation order references the correct doc numbers
- No em dashes in the document
- No personal identifiers (emails, coordinates, UIDs) in the document
