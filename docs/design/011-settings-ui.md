# 011 - Settings UI

## Context

Heliotrope requires each user to configure two external credentials before the system can function: a Slack API token (so Cloud Functions can update the user's profile photo) and an iOS Shortcut bearer token (so the Shortcut can post location updates to the `ingestLocation` endpoint). Both credentials are sensitive and must be handled carefully. The Slack token is stored encrypted in Firestore and never returned to the client after submission. The iOS Shortcut bearer is shown to the user exactly once at generation time.

Beyond credentials, users need a place to adjust operational parameters such as the scheduler interval, the minimum time between Slack uploads, and their default fallback image. These settings live in the user's profile document and affect how `syncAvatar` behaves.

The Settings page (`/settings`) consolidates all of these concerns into a single UI surface. This document covers the page layout, the data flows for each settings section, and the security constraints that govern how credentials are handled.

## Proposal

### Route and layout

The Settings page is accessible at `/settings` and is available to authenticated users only. It is divided into three sections, each rendered as a distinct card or panel:

1. **Slack Connection**
2. **iOS Shortcut Bearer**
3. **Account Settings**

### Slack Connection

This section manages the per-user Slack token lifecycle.

**States**

The section renders differently based on whether a Slack token is currently stored:

- **Disconnected**: shows a text input for the Slack token and a "Connect" button.
- **Connected**: shows connection details (workspace name, Slack user ID, last validated timestamp) and a "Reconnect" button that reveals the token input for replacement. The token itself is never displayed.

**Connect flow**

1. User enters a Slack token in the input field.
2. User clicks "Connect."
3. UI calls `POST /setSlackToken` with the token in the request body. The request includes the user's Firebase ID token in the `Authorization` header.
4. The Cloud Function:
   - Verifies the ID token via `requireAuthedUser`.
   - Calls the Slack `auth.test` endpoint with the provided token to verify it is valid and to retrieve `user_id`, `team_id`, and `team` (workspace name).
   - Encrypts the token using `TOKEN_ENCRYPTION_KEY` and writes the encrypted value, along with metadata, to `users/{uid}/secrets/slack`.
   - Updates `users/{uid}/profile/singleton` with `slack.connected: true`, `slack.teamId`, `slack.userId`, and `slack.teamName`. The `setSlackToken` function also copies `lastValidatedAt` to a `slack.lastValidatedAt` field on the profile document so the client can display it without reading the secrets subcollection.
   - Returns `{ ok: true, slackTeamId, slackUserId }`. The plaintext token is never included in the response.
5. UI clears the input field and transitions to the connected state, displaying the workspace and user information from the response.

**Reconnect flow**

Clicking "Reconnect" reveals the token input field. Submitting a new token follows the same connect flow and overwrites the previous encrypted token.

**Error handling**

- If the Slack `auth.test` call fails (invalid token, revoked token, network error), the Function returns an error. The UI displays "Could not verify this token. Please check that it is correct and try again."
- If the ID token is invalid or missing, the Function returns 401. The UI redirects to sign-in.

**Security constraints**

- The plaintext token is transmitted over HTTPS only, in the request body (never in URL parameters or headers beyond the ID token).
- The token is never stored in the client (no localStorage, no sessionStorage, no cookies).
- The token is never returned to the client after storage. The UI shows connection status derived from the profile document, not from the secrets document.

### iOS Shortcut Bearer

This section manages the bearer token used by the iOS Shortcut to authenticate `POST /ingestLocation` requests.

**States**

- **No bearer generated**: shows a "Generate Bearer" button and explanatory text about what the bearer is for.
- **Bearer just generated**: shows the bearer value in a read-only, copy-enabled field with the message "This will not be shown again." Also shows a "Generate New Bearer" button.
- **Bearer previously generated (page revisit)**: shows "A bearer token was previously generated" with the creation timestamp, and a "Generate New Bearer" button. The bearer value is not shown because it was only available at generation time.

**Generation flow**

1. User clicks "Generate Bearer" (or "Generate New Bearer").
2. If a bearer already exists, the UI shows a confirmation dialog: "Generating a new bearer will invalidate the current one. Any iOS Shortcut using the old bearer will stop working until you update it. Continue?"
3. On confirmation, the UI calls `POST /generateIosShortcutBearer` with the user's Firebase ID token in the `Authorization` header.
4. The Cloud Function:
   - Verifies the ID token via `requireAuthedUser`.
   - Generates a bearer string in the format `<uid>:<32-byte-random-base64url>`.
   - Computes the SHA-256 hash of the opaque portion (the part after the colon).
   - Writes `{ bearerHash, createdAt, lastUsedAt: null }` to `users/{uid}/secrets/iosShortcutBearer`, overwriting any previous value.
   - Returns `{ ok: true, bearer: "<uid>:<opaque>" }`. This is the only time the full bearer is returned.
5. UI displays the bearer in the read-only copy field.

**Security constraints**

- The full bearer is shown to the user exactly once, immediately after generation.
- On subsequent page loads, the UI reads `profile.iosShortcutBearer.createdAt`, which the `generateIosShortcutBearer` function copies from the secrets doc to the profile document. The bearer value itself cannot be retrieved.
- Regeneration invalidates the old bearer immediately. There is no grace period or rotation mechanism in v1.

### Account Settings

This section provides controls for general user preferences.

**Fields**

| Field                             | Type                   | Default       | Description                                                                                                                |
| --------------------------------- | ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Display name                      | Text input             | Set at signup | User's display name, written to `profile.displayName`                                                                      |
| Scheduler interval                | Number input (minutes) | 15            | How often `syncAvatar` evaluates rules for this user. Written to `profile.scheduler.intervalMinutes`                       |
| Min seconds between Slack uploads | Number input (seconds) | 300           | Minimum gap between consecutive Slack `users.setPhoto` calls. Written to `profile.scheduler.minSecondsBetweenSlackUploads` |
| Default image                     | Image picker           | None          | The fallback image used when no rule matches and no override is active. Written to `profile.defaultImageId`                |

**Save behavior**

Each field saves independently on blur or on an explicit "Save" action. The UI provides inline confirmation ("Saved") that fades after a short delay. Validation errors are shown inline next to the field.

**Validation**

- Display name: required, 1 to 100 characters.
- Scheduler interval: integer, minimum 5, maximum 1440 (24 hours).
- Min seconds between Slack uploads: integer, minimum 60, maximum 86400 (24 hours).
- Default image: must reference an existing image in the user's library, or be null (no default).

### Profile document structure

The Settings page reads from and writes to `users/{uid}/profile/singleton`. The relevant fields:

```ts
{
  displayName: string
  email: string
  slack: {
    connected: boolean
    teamId: string | null
    userId: string | null
    teamName: string | null
    lastValidatedAt: Timestamp | null     // copied from secrets by setSlackToken
  }
  createdAt: Timestamp
  scheduler: {
    intervalMinutes: number
    minSecondsBetweenSlackUploads: number
  }
  defaultImageId: string | null
  iosShortcutBearer: {                    // copied from secrets by generateIosShortcutBearer
    createdAt: Timestamp
    lastUsedAt: Timestamp | null
  } | null
}
```

This extends the profile shape from the architecture doc (000) with two fields surfaced from the secrets subcollection: `slack.lastValidatedAt` and `iosShortcutBearer`. The `setSlackToken` and `generateIosShortcutBearer` functions maintain these fields so the Settings UI can display credential metadata without reading the locked secrets subcollection.

The `slack` fields are updated by the `setSlackToken` Cloud Function (not by the client directly). The client reads these fields to render the connection status. The `scheduler` and `defaultImageId` fields are written directly by the client through Firestore (permitted by the `isOwner` rule on the profile subcollection).

### Components

The Settings page is composed of the following components:

- **`SlackTokenInput`** (`apps/web/src/components/SlackTokenInput.tsx`): the token input field, connect/reconnect button, and connection status display.
- **`IosShortcutBearerPanel`** (`apps/web/src/components/IosShortcutBearerPanel.tsx`): the bearer generation button, confirmation dialog, copy field, and status display.
- **`Settings`** page (`apps/web/src/pages/Settings.tsx`): the parent page that composes the three sections.

Each component has a colocated `*.stories.tsx` file.

## Alternatives considered

**Slack OAuth flow instead of manual token entry.** A full OAuth flow would provide a smoother user experience: the user clicks "Connect to Slack," is redirected to Slack's authorization page, grants permissions, and is redirected back with an access token. This was rejected for v1 because it requires hosting an OAuth callback endpoint, managing OAuth state parameters, and registering a Slack app with redirect URLs. For a single-user tool, pasting a token from the Slack app settings page is sufficient. OAuth can be added later without changing the encrypted storage model.

**Bearer token stored in a Functions secret instead of per-user Firestore.** Storing the iOS Shortcut bearer as a Functions secret would be simpler for a single user. This was rejected because it prevents the Settings UI from managing the bearer (the user would need CLI access to rotate it), and it does not scale to multiple users. Per-user storage in Firestore with a hashed comparison keeps the bearer management self-service.

**Inline editing for all settings (no save button).** Auto-saving every field on change would eliminate the need for save buttons but introduces the risk of accidental saves (e.g., while the user is still typing a display name). The chosen approach saves on blur or on explicit "Save" action, which provides a balance between convenience and intentionality.

**Separate pages for Slack settings and account settings.** Splitting settings across multiple pages would reduce the length of any single page but adds navigation overhead for a small number of settings. A single page with clearly separated sections is appropriate for the current scope.

**Displaying the Slack token in a masked field (e.g., showing the last 4 characters).** Even a partial reveal of the token increases the risk of exposure through screenshots or screen sharing. The chosen approach shows only the connection status (workspace name, user ID, validation timestamp) and never reveals any part of the stored token.

## Open questions

- Should the Settings page show `lastUsedAt` for the iOS Shortcut bearer so the user can verify the Shortcut is working? This requires surfacing data from the `secrets` subcollection, which is not client-readable. Options: (a) copy `lastUsedAt` to the profile doc on each ingest, or (b) add a Cloud Function that returns bearer metadata without the bearer value.
- Should there be a "Disconnect Slack" action that deletes the encrypted token, or is reconnecting with a new token sufficient?
- Should the default image picker show image thumbnails inline, or open the full image library picker as a modal?

## Acceptance criteria

- The Settings page is accessible at `/settings` for authenticated users.
- **Slack Connection**:
  - In the disconnected state, the UI shows a token input and "Connect" button.
  - Submitting a valid Slack token calls `POST /setSlackToken`, which verifies the token via `auth.test`, encrypts it, stores it, and returns workspace and user metadata.
  - In the connected state, the UI shows workspace name, Slack user ID, and last validated timestamp. The token is never displayed.
  - Submitting an invalid token displays an error message without storing anything.
  - The "Reconnect" button allows replacing the stored token.
- **iOS Shortcut Bearer**:
  - Clicking "Generate Bearer" calls `POST /generateIosShortcutBearer`, which returns the full bearer exactly once.
  - The bearer is displayed in a read-only, copy-enabled field with "This will not be shown again."
  - On subsequent page visits, the UI shows that a bearer was previously generated but does not display the value.
  - Regeneration shows a confirmation dialog warning that the old bearer will be invalidated.
  - After regeneration, the old bearer no longer authenticates `ingestLocation` requests.
- **Account Settings**:
  - Display name, scheduler interval, min seconds between uploads, and default image are editable and persist to the profile document.
  - Validation prevents invalid values (empty display name, interval below 5, etc.).
  - Save confirmation is shown inline.
- **Stories**:
  - `SlackTokenInput` has stories for disconnected state, connected state, submitting state, and error state.
  - `IosShortcutBearerPanel` has stories for no-bearer state, just-generated state, and previously-generated state.
  - `Settings` page has stories composing all sections in various states.
- **Cypress E2E**:
  - Test covers the full Slack token management flow: enter token, connect, verify connected status, reconnect with a new token.
  - Test covers the bearer generation flow: generate, copy, revisit page and verify bearer is no longer visible, regenerate.
  - Network calls to Slack are intercepted via `cy.intercept`. No real Slack API calls are made.
- **Security**:
  - The Slack token is never returned in any API response after storage.
  - The iOS Shortcut bearer is returned exactly once at generation time.
  - The `secrets` subcollection is not readable by clients (enforced by Firestore rules and verified by rules tests).
  - No tokens, bearers, or personal identifiers appear in application logs.
- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm test` passes with unit tests for any pure helpers used by the Settings components.
- `pnpm build` succeeds.
