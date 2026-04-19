# CLAUDE.md

## Project overview

Heliotrope is a personal tool that automatically updates a Slack profile photo based on real-world context (time, location, weather, holidays). It runs as a Firebase-backed monorepo with a Vite + React frontend deployed on Netlify. All architecture decisions are documented in [docs/design/000-architecture.md](docs/design/000-architecture.md).

## Critical rules

- No em dashes anywhere in code, comments, docstrings, or written content. Restructure sentences instead.
- No personal data in the repo: no emails, UIDs, names, or home coordinates.
- Design-doc-first workflow: write or update `docs/design/NNN-*.md` and get approval before writing implementation code.
- No `any` types. No `@ts-ignore`. Use `@ts-expect-error` only with a comment explaining the reason.
- TypeScript `strict: true` and `noUncheckedIndexedAccess: true` everywhere.
- Never commit secrets, service account keys, or `seed/rules.seed.json`.
- Do not echo user secrets (tokens, bearers) in API responses or logs.

## Commands

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `make dev`             | Start emulators + Vite dev server (background) |
| `make dev-stop`        | Stop background dev processes                  |
| `make cypress`         | Run Cypress E2E (starts services if needed)    |
| `make cypress-open`    | Open Cypress interactive runner                |
| `make check`           | typecheck + lint + test + build                |
| `pnpm dev`             | Start local dev server                         |
| `pnpm test`            | Run unit, rules, and integration tests         |
| `pnpm lint`            | Lint all packages                              |
| `pnpm typecheck`       | TypeScript type checking across the monorepo   |
| `pnpm build`           | Build all apps                                 |
| `pnpm emulators`       | Start Firebase Emulator Suite                  |
| `pnpm storybook`       | Start Storybook dev server                     |
| `pnpm storybook:build` | Build Storybook for Chromatic                  |
| `pnpm cypress`         | Run Cypress E2E tests                          |

## File organization

- **New condition type**: add matcher in `apps/functions/src/resolver/conditions/`, editor component in `apps/web/src/components/ConditionEditor/`, a colocated test file, and a colocated story file.
- **New Cloud Function**: add handler in `apps/functions/src/http/` or `apps/functions/src/scheduled/`, export from `apps/functions/src/index.ts`, add a colocated test file.
- **New page**: add in `apps/web/src/pages/`, add a colocated `*.stories.tsx` file.
- **New Zod schema**: add in `packages/schema/src/`, export from the package.
- **Custom ESLint rules**: add in `tooling/eslint-plugin-heliotrope/`.

## Testing requirements (before a PR is ready)

- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm test` passes (unit + rules + integration via Firebase Emulator)
- `pnpm build` succeeds for each app
- Storybook builds and Chromatic has no unreviewed visual changes
- Affected Cypress E2E tests pass

## Debugging recipes

- **Why was a given image chosen?** Inspect `users/{uid}/decisions/{latest}` in Firestore. The `trace` array shows each rule evaluated, whether it matched, and which condition failed.
- **Failed Slack upload?** Check `users/{uid}/slackState/singleton` for `lastUploadError`.
- **Replay signals through resolver locally:** call `POST /testRule` with a rule body against the emulator.
- **Reset Slack token in emulator:** delete `users/{uid}/secrets/slack` in the emulator UI, then re-enter via Settings.

## What not to do

- Do not commit secrets, emails, or coordinates of real locations.
- Do not bypass the design-doc gate. No implementation code before the doc is approved.
- Do not skip Firestore rules tests when changing Firestore paths.
- Do not add `any` without a comment explaining why and a tracking issue link.
- Do not echo user secrets back in API responses or logs.

## Design docs

- [000 - Architecture](docs/design/000-architecture.md)
- [001 - Auth and Allowlist](docs/design/001-auth-and-allowlist.md)
- [002 - Firestore Schema](docs/design/002-firestore-schema.md)
- [003 - Condition Model](docs/design/003-condition-model.md)
- [004 - Resolver](docs/design/004-resolver.md)
- [005 - Image Library](docs/design/005-image-library.md)
- [006 - Rule Editor UI](docs/design/006-rule-editor-ui.md)
- [007 - Ingest and Scheduler](docs/design/007-ingest-and-scheduler.md)
- [008 - Slack Client](docs/design/008-slack-client.md)
- [009 - Testing Strategy](docs/design/009-testing-strategy.md)
- [010 - Deployment](docs/design/010-deployment.md)
- [011 - Settings UI](docs/design/011-settings-ui.md)
