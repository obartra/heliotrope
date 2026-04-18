# 001 - Auth and Allowlist

## Context

Heliotrope is a personal tool, but it is deployed on publicly reachable infrastructure (Netlify frontend, Firebase backend). Without an access gate, anyone who discovers the sign-in page could create an account and consume Firestore quota, Storage space, and Slack API calls. At the same time, the access model should be simple enough for a single-user v1 with no ongoing admin ceremony. Once authenticated, every user's data must be strictly isolated so that one user can never read or modify another user's documents or files.

This document covers three concerns: the authentication provider, the signup allowlist that restricts who can create an account, and the per-user data isolation enforced by Firestore rules, Storage rules, and Cloud Function auth helpers.

## Proposal

### Authentication provider

Firebase Auth with the email/password provider. Google sign-in is not used. The UI presents a single sign-in page (`/`) with email and password fields. On successful authentication the user is redirected to the Dashboard.

### Signup allowlist

An Auth blocking function named `beforeUserCreated` executes on every signup attempt. It reads the Functions secret `ALLOWED_SIGNUP_EMAILS`, which contains a JSON array of email addresses, and checks whether the incoming user's email is present in the list. If the email is not found, the function rejects user creation by throwing `HttpsError("permission-denied", "...")`. The UI catches this error and renders the message "This email is not allowed to sign up."

The allowlist is the sole global access-control mechanism. There are no custom claims, no admin grant scripts, and no service account keys required for daily operation. Adding a new allowed user means updating the Functions secret and redeploying.

Implementation lives in `apps/functions/src/auth/beforeUserCreated.ts` and is exported from `apps/functions/src/index.ts`.

### Firestore rules

All user data lives under `users/{uid}/...`. A shared helper function `isOwner(uid)` checks that the request is authenticated and that the caller's UID matches the path's `{uid}` segment.

The full Firestore rules are defined in `firestore.rules` at the repo root and detailed in the architecture doc (000). The access policy for each subcollection:

| Subcollection                                          | Client access                                         |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `profile`, `images`, `rules`, `overrides`, `locations` | Owner read/write                                      |
| `decisions`, `slackState`                              | Owner read-only (Cloud Functions write via Admin SDK) |
| `secrets`                                              | None (Cloud Functions access via Admin SDK)           |

### Storage rules

Storage rules mirror the Firestore ownership pattern. Only the owning user can read or write files under `users/{uid}/avatars/`. The rules are defined in `storage.rules` at the repo root.

### HTTPS Function auth helper

A shared utility function `requireAuthedUser(req): Promise<{ uid: string, email: string }>` verifies the Firebase ID token from the request's `Authorization` header. It returns the `uid` and `email` extracted from the decoded token. There is no claim check; the presence of a valid token is sufficient. All authed HTTPS Functions (`syncNow`, `testRule`, `setSlackToken`, `generateIosShortcutBearer`) use this helper.

The `ingestLocation` endpoint does not use this helper. It uses its own bearer token scheme (`<uid>:<opaque>`) validated against a per-user hash stored in Firestore (see design docs 007 and 011 for details).

### UI behavior

The sign-in page is the default route for unauthenticated users. It renders an email/password form. On submission:

- If the email is on the allowlist and credentials are valid, the user is signed in and redirected to the Dashboard.
- If the email is not on the allowlist and a signup is attempted, the blocking function rejects user creation. The UI displays "This email is not allowed to sign up."
- If the email is on the allowlist but the password is wrong (existing account), Firebase Auth returns the standard invalid-credential error, which the UI renders as a generic sign-in failure.

The UI does not proactively indicate whether an email is on the allowlist. It simply lets sign-in or signup succeed or fail.

## Alternatives considered

**Custom claims for role-based access.** Firebase custom claims allow attaching metadata (such as an "admin" role) to a user's auth token, which Firestore rules can then check. This was rejected because it requires a service account key and an admin grant script for daily use. The allowlist approach is simpler: a single Functions secret controls who can sign up, and Firestore rules handle isolation purely via UID matching.

**Google sign-in provider.** Google OAuth provides a smoother sign-in experience and eliminates password management. It was rejected because the allowlist still needs enforcement (blocking functions work the same way), and email/password is sufficient for a single-user tool. Adding Google sign-in later would not require schema changes.

**Firestore-based allowlist instead of a Functions secret.** Storing allowed emails in a Firestore collection would allow the UI to manage the list without redeploying. This was rejected for v1 because it introduces a bootstrapping problem (who writes the first allowed email?), requires additional Firestore rules for the allowlist collection, and adds complexity for a list that will rarely change.

**IP-based access restriction.** Restricting access by IP address was considered but rejected because the user accesses the tool from multiple networks (home, office, mobile). Firebase Auth with an email allowlist provides identity-based access that works regardless of network.

## Open questions

- If the allowlist grows beyond a few entries, should it move from a Functions secret to a Firestore collection with a bootstrap mechanism? For v1 the secret is sufficient.

## Acceptance criteria

- `beforeUserCreated` blocking function is deployed and reads from `ALLOWED_SIGNUP_EMAILS` Functions secret.
- A signup attempt with an email on the allowlist succeeds and creates a Firebase Auth user.
- A signup attempt with an email not on the allowlist is rejected with `HttpsError("permission-denied")` and the UI displays "This email is not allowed to sign up."
- Firestore rules tests cover every subcollection path for: owner access (allowed), non-owner access (denied), unauthenticated access (denied), and cross-user write attempts (denied).
- `decisions` and `slackState` are read-only from the client (owner can read, write is denied for all clients).
- `secrets` has no client access at all (both read and write denied for all clients).
- Storage rules tests confirm that only the owning user can read/write files under `users/{uid}/avatars/`.
- `requireAuthedUser` correctly extracts `uid` and `email` from a valid ID token and rejects requests with missing or invalid tokens.
- Sign-in page renders email/password fields, handles success (redirect to Dashboard), and handles failure (displays error message).
- No personal identifiers (emails, UIDs, names) appear in the codebase. The allowlist content is stored only in the Functions secret at runtime.
- `pnpm test` passes with Firestore and Storage rules tests included.
- `pnpm typecheck` and `pnpm lint` pass.
