# 009 - Testing Strategy

## Context

Heliotrope combines a frontend SPA, Cloud Functions, Firestore security rules, Storage rules, external API integrations (Slack, Open-Meteo), and a location-ingestion pipeline driven by an iOS Shortcut. Bugs in any layer can cause the wrong avatar to be set, tokens to leak, or unauthorized access to succeed. A comprehensive testing strategy is necessary to catch regressions across all of these surfaces before they reach production.

Because the project follows a design-doc-first workflow, each milestone ships with the tests that cover its acceptance criteria. CI must enforce quality gates automatically so that no PR merges with broken types, lint violations, failing tests, or unreviewed visual changes.

This document defines the test layers, tooling choices, coverage targets, mocking boundaries, and CI pipeline that together form the project's quality contract.

## Proposal

### Test layers

The project uses five distinct test layers, each targeting a different class of defect.

#### 1. Unit tests (Vitest)

The architecture doc (000, section 'Testing') defines the scope and edge cases for each test area. Key targets:

- `packages/schema`: round-trip and rejection tests. 100% coverage.
- `apps/functions/src/resolver/conditions/*.test.ts`: one file per matcher with edge cases (year wrapping, midnight crossing, polygon edges, antimeridian, DST, staleness).
- `apps/functions/src/resolver/index.test.ts`: 30+ cases for priority, overrides, defaults, disabled rules.
- `apps/functions/src/slack/hash.ts`: hash stability.
- `apps/web/src/lib/**`: pure helpers.

#### 2. Firestore and Storage rules tests (`@firebase/rules-unit-testing`)

Tests run against the Firebase Emulator. Every subcollection under `users/{uid}/` has allow and deny cases for owner, non-owner, and unauthenticated access. `decisions` and `slackState` deny client writes. `secrets` denies all client access. Coverage target: 100% of documented policies.

#### 3. Integration tests (Firebase Emulator Suite)

Cloud Function handlers tested with real Firestore but mocked external APIs (`msw`). Covers `ingestLocation` (valid/invalid bearer, trimming), `syncNow` (full pipeline, returns trace), `syncAvatar` (manual invocation, hash dedup, rate limiting), and `testRule` (per-condition results, no writes).

#### 4. Component tests and visual regression (Storybook + Chromatic)

Every component and page has at least one `*.stories.tsx` covering empty, populated, loading, and error states. Condition editors include invalid-input stories. The a11y addon runs Axe on every story; serious/critical violations fail CI. Chromatic runs on every PR and blocks merge on unreviewed visual changes.

#### 5. End-to-end tests (Cypress)

Cypress runs against a Netlify deploy preview with the Firebase Emulator backend. All external API calls stubbed via `cy.intercept`. Scenarios: smoke test (sign in, upload, create rule, override, observe log), rule editor happy paths per condition type, override TTL expiry, image delete with rule reference warning, and Settings flows.

### Mocking boundary

`msw` mocks all external HTTP calls (Slack API, Open-Meteo forecast, Open-Meteo geocoding) in unit and integration tests. Cypress uses `cy.intercept`. No real external API calls occur in CI.

### Coverage targets

| Scope                                                          | Statements                                 | Branches |
| -------------------------------------------------------------- | ------------------------------------------ | -------- |
| Per-package default                                            | 85%                                        | 80%      |
| `packages/schema`                                              | 100%                                       | 100%     |
| Resolver (`apps/functions/src/resolver/`)                      | 95%+                                       | 95%+     |
| Condition matchers (`apps/functions/src/resolver/conditions/`) | 95%+                                       | 95%+     |
| Firestore and Storage rules                                    | 100% of documented policies (allow + deny) | N/A      |

CI fails if coverage for any modified package drops below these targets.

### CI pipeline (GitHub Actions)

Two workflow files handle the CI pipeline.

**`ci.yml`** (runs on every PR):

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` across the monorepo.
3. `pnpm lint` across the monorepo.
4. `pnpm test` which runs unit tests, Firestore/Storage rules tests, and integration tests via the Firebase Emulator.
5. `pnpm build` for each app.
6. `pnpm storybook:build` followed by a Chromatic publish step.

**`cypress.yml`** (runs on every PR, after Netlify deploy preview is ready):

7. Netlify deploy preview spins up automatically (triggered by the PR).
8. Cypress runs against the deploy preview URL with the Firebase Emulator as the backend.

Merge is blocked unless all checks are green and Chromatic has no unreviewed visual changes.

### Local development testing

Developers can run the full test suite locally:

- `pnpm test` runs unit, rules, and integration tests (starts the Firebase Emulator automatically if needed).
- `pnpm storybook` starts the Storybook dev server for visual inspection.
- `pnpm cypress` opens the Cypress test runner against a local dev server.

Pre-commit hooks (Husky + lint-staged) run typecheck on affected packages, lint and format changed files, and execute affected unit tests. Commits are blocked on failure.

## Alternatives considered

**Jest instead of Vitest.** Jest is widely used and well-documented. Vitest was chosen instead because it shares Vite's transform pipeline (already used for the frontend build), supports TypeScript and ESM natively without additional configuration, and runs significantly faster for this project's module setup. Switching to Jest later would require minimal test rewriting since the assertion APIs are compatible.

**Playwright instead of Cypress for E2E.** Playwright offers multi-browser support and a more modern architecture. Cypress was chosen because its `cy.intercept` API provides straightforward network stubbing, its time-travel debugging UI is valuable for a single developer, and the project only needs to target Chrome. Playwright remains a viable option if cross-browser testing becomes necessary.

**Testing Library for component tests instead of Storybook + Chromatic.** React Testing Library is excellent for behavioral component testing, but it does not catch visual regressions. Storybook provides a living component catalog that doubles as documentation, and Chromatic adds screenshot-based diff detection. The two approaches are complementary; React Testing Library could be added later for interaction-heavy components without replacing Storybook.

**Separate coverage tool (Istanbul/nyc) instead of Vitest's built-in coverage.** Vitest includes built-in coverage reporting via `v8` or `istanbul` providers. Using the built-in provider avoids an additional dependency and configuration layer. The `v8` provider is used by default for speed.

**`nock` instead of `msw` for HTTP mocking.** `nock` patches Node's `http` module directly, which works well for server-side code but does not extend to browser environments. `msw` intercepts at the network level and works in both Node and browser contexts, providing a consistent mocking approach across unit tests, integration tests, and Storybook stories.

## Open questions

- Should integration tests run in a dedicated CI job (parallel with unit tests) or sequentially after unit tests? Running them in parallel reduces total CI time, but requires two Emulator instances.
- Should Cypress tests run against a fresh Emulator database for each test file, or should a shared seed be loaded once per run? Per-file isolation is cleaner but slower.
- Should Storybook interaction tests (via `@storybook/test`) be adopted for complex interactive components (such as the Leaflet-based geofence editors), or should those interactions be covered exclusively by Cypress?

## Acceptance criteria

- Vitest is configured in the monorepo root (`vitest.config.ts`) and runs all `*.test.ts` files across `packages/schema`, `apps/functions`, and `apps/web`.
- `packages/schema` has 100% statement and branch coverage.
- Every condition matcher in `apps/functions/src/resolver/conditions/` has a colocated `*.test.ts` file covering the edge cases listed in this document.
- `apps/functions/src/resolver/index.test.ts` contains 30+ test cases covering priority, empty conditions, disabled rules, override precedence, and default fallthrough.
- Firestore rules tests cover every subcollection path for owner, non-owner, unauthenticated, and cross-user scenarios. `decisions` and `slackState` are client-write-denied. `secrets` has no client access.
- Storage rules tests confirm owner-only access to `users/{uid}/avatars/`.
- Integration tests for `ingestLocation`, `syncNow`, `syncAvatar`, and `testRule` run against the Firebase Emulator Suite and pass.
- `msw` is configured to mock Slack and Open-Meteo endpoints. No real external API calls occur during any test run.
- Every component and page in the web app has at least one Storybook story. Stories cover empty, populated, loading, and error states.
- The Storybook a11y addon is enabled and Axe violations at the serious or critical level fail CI.
- Chromatic is configured and runs on every PR. Merge is blocked on unreviewed visual changes.
- Cypress E2E tests cover the smoke test, rule editor happy paths, override TTL expiry, and image delete with rule reference warning.
- Cypress uses `cy.intercept` for all external API calls. No real Slack or Open-Meteo calls are made.
- GitHub Actions workflows (`ci.yml` and `cypress.yml`) implement all pipeline steps described in this document.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass.
- Pre-commit hooks run typecheck, lint, and affected unit tests; commits are blocked on failure.
