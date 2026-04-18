# 010 - Deployment

## Context

Heliotrope has two independently deployed artifacts: a static frontend (Vite + React) and a set of Firebase Cloud Functions. The frontend must be served from a CDN with SPA routing support. The backend must run in a managed environment with access to Firestore, Storage, and Cloud Scheduler. Both must handle secrets securely and support a workflow where the developer can test locally against emulators before deploying to production.

For v1 there is only one environment: production. The Firebase Emulator Suite serves as the local development and testing environment. This document covers the deployment targets, secret management, CI integration, and the manual steps required to go from a passing CI build to a live system.

## Proposal

### Frontend: Netlify

The web application (`apps/web`) is a static Vite + React SPA deployed to Netlify.

**Build configuration**

The Netlify build configuration lives in `apps/web/netlify.toml`:

```toml
[build]
  command = "pnpm build"
  publish = "apps/web/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The `publish` path assumes Netlify's base directory is set to the repository root in the Netlify dashboard. If the base directory is changed to `apps/web/`, update `publish` to `dist`.

The redirect rule ensures that all routes are handled by the SPA's client-side router. Netlify serves the built assets from `apps/web/dist`.

**Environment variables**

Netlify environment variables (set in the Netlify dashboard, not in the repo) include:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FUNCTIONS_URL` (the base URL for Cloud Functions, e.g. `https://us-central1-<project-id>.cloudfunctions.net`)

These are build-time variables baked into the client bundle by Vite. They are not secrets; they identify the Firebase project and are visible in the browser.

**Deploy flow**

- Netlify auto-deploys from the `main` branch on every push.
- Every PR gets a deploy preview URL, which Cypress E2E tests run against in CI.
- No manual deploy steps are required for the frontend after initial Netlify site setup.

### Backend: Firebase Cloud Functions

Cloud Functions are deployed to Firebase from the `apps/functions` directory.

**Runtime**

- Node 20 runtime.
- Firebase Cloud Functions v2.
- Region: `us-central1` (default; see open questions).

**Deploy command**

Functions are deployed manually:

```bash
firebase deploy --only functions
```

This deploys all exported functions from `apps/functions/src/index.ts`. The deploy uses the Firebase project configured in `.firebaserc` (not committed to the repo; created locally via `firebase use <project-id>`).

All Cloud Functions exported from `apps/functions/src/index.ts` are deployed. See design docs 001 (auth), 007 (ingest/scheduler), 008 (Slack), and 011 (settings) for the full function list.

**Cloud Scheduler**

The `syncAvatar` function uses the `onSchedule` helper from the Firebase Functions SDK. The default schedule is every 15 minutes. The schedule is configured in the function definition, not as a separate Cloud Scheduler resource.

### Firestore and Storage deployment

Firestore rules, Firestore indexes, and Storage rules are deployed alongside or independently of Functions:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

The source files are at the repo root:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

These files are committed to the repo and validated by rules tests before deployment.

### Secret management

Functions secrets (`ALLOWED_SIGNUP_EMAILS`, `TOKEN_ENCRYPTION_KEY`) are set via `firebase functions:secrets:set` and stored in Google Cloud Secret Manager. See the architecture doc (000) for secret descriptions.

`.gitignore` excludes: `*serviceAccount*.json`, `seed/rules.seed.json`, `.env*`, `node_modules/`, `dist/`, `.firebase/`.

### Environments

For v1, the project operates with two environments:

| Environment | Frontend                                  | Backend                                  | Database                       |
| ----------- | ----------------------------------------- | ---------------------------------------- | ------------------------------ |
| Production  | Netlify (auto-deployed from `main`)       | Firebase Cloud Functions (`us-central1`) | Firestore (production project) |
| Local / CI  | Vite dev server or Netlify deploy preview | Firebase Emulator Suite                  | Firestore Emulator             |

There is no staging environment for v1. The Firebase Emulator Suite provides a fully functional local backend that mirrors production behavior, including Firestore rules enforcement and Cloud Function execution.

### CI integration

The deployment pipeline builds on the CI workflow defined in design doc 009:

1. **PR phase**: CI runs typecheck, lint, tests, build, Storybook/Chromatic, and Cypress against the Netlify deploy preview. No production deployment occurs.
2. **Merge to `main`**: Netlify auto-deploys the frontend. Firebase Functions are deployed manually after verifying the merge.

There is no automated Firebase Functions deployment from CI in v1. This is a deliberate choice to keep the deployment pipeline simple and avoid storing a service account key in CI secrets. Automated Functions deployment can be added later by configuring a CI service account with the `cloudfunctions.developer` role.

### First-time setup

The architecture doc (000, section 'Human-only prerequisites') lists the complete setup steps. In summary: create Firebase project, set secrets, deploy rules and functions, create Netlify site with environment variables, push to `main`, sign in, and configure credentials via Settings.

### Rollback

**Frontend**: Netlify maintains deploy history. Rolling back is done via the Netlify dashboard by publishing a previous deploy.

**Functions**: Firebase does not maintain a built-in rollback mechanism for Cloud Functions. To roll back, check out the previous commit and redeploy with `firebase deploy --only functions`. Firestore rules and Storage rules can be redeployed the same way.

## Alternatives considered

**Firebase Hosting instead of Netlify for the frontend.** Firebase Hosting provides CDN-backed static site hosting with automatic SSL, similar to Netlify. Netlify was chosen because it provides deploy previews per PR out of the box (useful for Cypress E2E in CI), integrates with the existing Netlify account, and keeps the frontend deployment independent from the Firebase project. Firebase Hosting could be adopted later without code changes.

**Vercel instead of Netlify.** Vercel offers a similar static hosting and deploy preview experience. Netlify was chosen due to existing familiarity and the simplicity of its `netlify.toml` configuration for SPAs. The two are interchangeable for this use case.

**Automated Firebase Functions deployment from CI.** An automated pipeline would deploy Functions on every merge to `main`, reducing manual steps. This was deferred because it requires storing a Firebase service account key in CI secrets, which adds a security surface. For a single-user v1 with infrequent Function changes, manual deployment is acceptable.

**Terraform or Pulumi for infrastructure-as-code.** Infrastructure-as-code tools would codify the Firebase project setup, secrets, and deployment configuration. This was rejected as overkill for a single-project, single-user tool. The Firebase CLI and console provide sufficient management for v1.

**Docker-based backend instead of Cloud Functions.** Running the backend in a container (Cloud Run, Fly.io, or a VPS) would provide more control over the runtime environment and avoid cold starts. Firebase Cloud Functions were chosen because they integrate natively with Firestore triggers, Cloud Scheduler, and the Auth blocking function, all of which this project relies on. The managed scaling and zero-ops nature of Cloud Functions fit a personal tool that should not require monitoring.

**Staging environment.** A separate Firebase project for staging would allow testing against production-like infrastructure before deploying. This was deferred for v1 because the Firebase Emulator Suite provides a faithful local replica, and the project has only one user. A staging environment can be added by creating a second Firebase project and a `staging` branch with its own Netlify site.

## Open questions

- Should the Firebase region be `us-central1` (default) or a region closer to the primary user's location? Changing the region after deployment requires recreating the Firestore database.
- Should Firebase Functions deployment be automated in CI after v1 stabilizes? If so, what is the minimal IAM role required for the CI service account?
- Should Firestore rules and Storage rules be deployed automatically on merge to `main`, even if Functions deployment remains manual?
- Should the project adopt `.firebaserc` with project aliases (e.g., `default` for production) and commit it, or keep it local-only?

## Acceptance criteria

- `apps/web/netlify.toml` is configured with the correct build command, publish directory, and SPA redirect rule.
- Netlify auto-deploys the frontend from the `main` branch. Deploy previews are generated for every PR.
- All Firebase Cloud Functions listed in this document are deployable via `firebase deploy --only functions` and function correctly in production.
- Firestore rules, Firestore indexes, and Storage rules are deployable via `firebase deploy` and match the committed source files.
- Functions secrets (`ALLOWED_SIGNUP_EMAILS`, `TOKEN_ENCRYPTION_KEY`) are set via `firebase functions:secrets:set` and accessible at runtime. They are never committed to the repo.
- `.gitignore` excludes `*serviceAccount*.json`, `seed/rules.seed.json`, `.env*`, `node_modules/`, `dist/`, and `.firebase/`.
- The CI pipeline (defined in design doc 009) passes all checks before any deployment occurs.
- Cypress E2E tests run against the Netlify deploy preview with the Firebase Emulator as the backend.
- The first-time setup steps documented in this design doc are sufficient to bring up a working production deployment from a clean start.
- Rollback procedures for both frontend (Netlify) and backend (Firebase Functions) are documented and functional.
- No secrets, service account keys, or personal identifiers are committed to the repository.
- `pnpm build` produces a valid frontend bundle that Netlify can serve.
- `pnpm typecheck` and `pnpm lint` pass.
