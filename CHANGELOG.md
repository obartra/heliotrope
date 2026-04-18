# Changelog

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
