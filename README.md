# Heliotrope

[![Netlify Status](https://api.netlify.com/api/v1/badges/9bfcd71f-fa34-4e0b-8a7c-f733b9bc13ef/deploy-status)](https://app.netlify.com/projects/heliotropy/deploys)

A cloud-hosted tool that automatically rotates your Slack profile photo based on user-configurable rules. Rules combine an image with conditions (date, time, location, weather, etc.) that all must match. All rules and images are editable through the web UI.

The name refers to the flower that turns to face the sun. This one turns to face context.

## Prerequisites

- Node 20+
- pnpm 9+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Auth, and Storage enabled

## Local development

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm emulators    # Firebase Emulator Suite
```

## Commands

| Command                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `pnpm dev`             | Start the Vite dev server                    |
| `pnpm test`            | Run unit, rules, and integration tests       |
| `pnpm lint`            | Lint all packages                            |
| `pnpm typecheck`       | TypeScript type checking across the monorepo |
| `pnpm build`           | Production build for each app                |
| `pnpm emulators`       | Start Firebase Emulator Suite                |
| `pnpm storybook`       | Start Storybook dev server                   |
| `pnpm storybook:build` | Build Storybook for Chromatic                |
| `pnpm cypress`         | Run Cypress E2E tests                        |

## Project structure

```
apps/web/          Vite + React frontend (deployed to Netlify)
apps/functions/    Firebase Cloud Functions
packages/schema/   Shared Zod schemas
tooling/           Custom ESLint plugins
docs/design/       Design documents
```

## Design docs

Architecture and design decisions are documented in [`docs/design/`](docs/design/). Start with [000 - Architecture](docs/design/000-architecture.md) for the full system overview.

## Initial setup

See [Human-only prerequisites](docs/design/000-architecture.md#human-only-prerequisites) in the architecture doc for Firebase project creation, Slack app setup, Netlify wiring, and first sign-in steps.
