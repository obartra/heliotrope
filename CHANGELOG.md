# Changelog

## Milestone 4: Resolver + condition matchers

- `resolveImage` pure function in `apps/functions/src/resolver/index.ts` implementing the 4-step cascade: override, priority-sorted rules, default image, no-image fallback
- Condition dispatcher in `apps/functions/src/resolver/conditions/index.ts` mapping each condition type to its matcher
- 11 condition matchers: `date`, `dateRange`, `monthRange`, `dayOfWeek`, `timeRange`, `timeOfDay`, `geofenceCircle`, `geofencePolygon`, `country`, `weather`, `nearCity`
- Resolver types (`ResolverInput`, `ResolverOutput`, `ResolverSignals`, etc.) in `apps/functions/src/resolver/types.ts`
- `LOCATION_STALE_THRESHOLD_MINUTES` constant (120) in `apps/functions/src/resolver/constants.ts`
- Timezone-aware local time utility via `Intl.DateTimeFormat`
- 31 resolver tests covering overrides, rule sorting, AND short-circuiting, disabled rules, default/no-image fallbacks, location staleness, and timezone handling
- 82 condition matcher tests covering all 11 types with edge cases (year-boundary wrapping, midnight-crossing, concave polygons, stale/null location, polar day/night, etc.)
- Coverage: 98.47% statements, 92.19% branches across resolver code
- Added `@heliotrope/schema` as workspace dependency for `@heliotrope/functions`
- ESLint override for `packages/schema/src/**/*.test.ts`

## Milestone 3: Schemas and rules

- Zod schemas in `packages/schema/src/` for all document types: `image`, `rule`, `condition`, `override`, `location`, `decision`
- `ConditionSchema` discriminated union covering all 11 condition types (`date`, `dateRange`, `monthRange`, `dayOfWeek`, `timeRange`, `timeOfDay`, `geofenceCircle`, `geofencePolygon`, `country`, `weather`, `nearCity`)
- Shared `TimestampSchema` for Firestore Timestamp validation (works with both Admin and client SDKs)
- Supporting schemas: `TraceEntrySchema`, `SignalsSnapshotSchema`, `WeatherDataSchema`, `LocationSignalSchema`, `NearbyCitySchema`
- All TypeScript types derived from Zod via `z.infer`
- `firestore.indexes.json` with three composite indexes: `locations/timestamp`, `decisions/at`, `rules/priority` (all descending)
- ESLint override for `packages/schema/src/**/*.test.ts` to use the schema tsconfig
- 174 new schema tests across 7 test files with 100% coverage of valid parses, missing fields, wrong types, boundary values, and edge cases

## Milestone 2: Auth with allowlist

- `beforeUserCreated` blocking function enforcing `ALLOWED_SIGNUP_EMAILS` secret
- `requireAuthedUser` HTTPS auth helper extracting uid/email from ID tokens
- Sign-in page with email/password, sign-in/sign-up toggle, error handling
- Dashboard placeholder with sign-out
- Auth context provider with `useAuth` hook
- Firebase client SDK initialization with emulator auto-connect in dev
- React Router with protected and public-only routes
- Storybook stories for SignIn and Dashboard pages
- 13 new unit tests (8 allowlist, 5 auth helper)

## Milestone 1: Scaffold + methodology

- Monorepo with pnpm workspaces: `apps/web`, `apps/functions`, `packages/schema`, `tooling/eslint-plugin-heliotrope`
- Vite + React frontend wired to Netlify
- Firebase project init with Firestore rules, Storage rules, emulator config
- TypeScript project references with `strict: true` and `noUncheckedIndexedAccess: true`
- ESLint (with custom `no-em-dash` rule) + Prettier + Husky + lint-staged
- GitHub Actions CI (`ci.yml`, `cypress.yml`)
- Storybook + Chromatic scaffolding
- Cypress E2E scaffolding
- CLAUDE.md with project conventions
- Design docs 000-011 covering architecture through settings UI
- README with setup instructions and command reference
