# Changelog

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
