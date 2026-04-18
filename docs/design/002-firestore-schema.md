# 002 - Firestore Schema

## Context

Heliotrope stores all application state in Firestore: user profiles, uploaded image metadata, evaluation rules, manual overrides, location history, decision logs, Slack upload state, and per-user secrets. The schema must support real-time listeners (for the dashboard), efficient querying (for the scheduler and decision log), and strict per-user isolation (enforced by Firestore security rules defined in design doc 001).

Because this is a single-user tool in v1, the schema namespaces everything under `users/{uid}/...` so that multi-tenant support is possible later without a data migration. Zod schemas in `packages/schema` are the source of truth for document shapes. TypeScript types derive from these schemas via `z.infer`.

This document defines every Firestore collection, its document structure, indexing requirements, and the migration policy for schema changes.

## Proposal

### Collection layout

All documents live under the path `users/{uid}/`. Each subcollection is described below with its document ID scheme and TypeScript shape.

#### `users/{uid}/profile/singleton`

A single document per user holding display metadata, Slack connection status, scheduler configuration, and a fallback image reference.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Notable implementation details: the `slack.connected` flag drives `syncAvatar`'s user iteration; `scheduler` fields control evaluation frequency and upload throttling.

The `slack.connected` flag is what the scheduled `syncAvatar` function checks to decide whether to process this user. Secret material (the actual Slack token) lives in the separate `secrets` subcollection.

#### `users/{uid}/images/{imageId}`

One document per uploaded avatar image. The `imageId` is a UUID generated at upload time and serves as both the document ID and the key referenced by rules and overrides.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `id` (matches document ID), `storagePath` (points to `users/{uid}/avatars/{imageId}.png`), `tags` (freeform strings for UI grouping), and dimension/size metadata.

#### `users/{uid}/rules/{ruleId}`

One document per evaluation rule. The `ruleId` is a UUID. Rules are evaluated in descending `priority` order by the resolver.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `priority` (higher wins; UI spaces values in steps of 10), `imageId` (references an image document), and `conditions` (ANDed array; empty means the rule always matches).

The `Condition` type is a tagged union defined in design doc 003. Conditions are stored inline as an array within the rule document rather than as a separate subcollection.

#### `users/{uid}/overrides/active`

A single well-known document that represents a manual override. When present and not expired, the resolver returns this image without evaluating any rules.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `imageId`, `expiresAt` (null means pinned indefinitely), and `source` (`"ui"` or `"ios-shortcut"`).

To clear an override, delete this document. The resolver treats a missing document the same as no active override.

#### `users/{uid}/locations/{timestamp}`

Location reports from the iOS Shortcut or browser geolocation. The document ID is the ISO timestamp string of the report.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `lat`/`lon` coordinates, `accuracy`, `timestamp`, and `source` (`"ios-shortcut"` or `"browser"`).

The collection is trimmed to the 500 newest documents on each write. The `ingestLocation` Cloud Function handles trimming for iOS Shortcut writes. Browser writes trim via a client-side helper that deletes excess documents after writing.

#### `users/{uid}/decisions/{autoId}`

One document per resolver evaluation, written exclusively by Cloud Functions (the client has read-only access). The document ID is a Firestore auto-generated ID.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `chosenImageId`, `reason`, `trace` (array recording each rule evaluated, whether it matched, and which condition failed), `uploaded`, and `signalsSnapshot`.

The `trace` array records every rule that was evaluated, whether it matched, and (if it did not match) which condition failed and why. This supports the debugging recipe: inspect `users/{uid}/decisions/{latest}` to understand why a particular image was chosen.

The collection is trimmed to the 1,000 newest documents.

#### `users/{uid}/slackState/singleton`

A single document tracking the most recent Slack upload outcome. Written exclusively by Cloud Functions.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `lastUploadedImageHash` (used for deduplication), `lastUploadedAt`, and `lastUploadError`.

The `lastUploadedImageHash` is used for deduplication: if the winning image's hash matches the last uploaded hash, the upload is skipped.

#### `users/{uid}/secrets/slack`

Per-user Slack token, encrypted at rest. No client access (both read and write denied by Firestore rules). Only Cloud Functions read and write this document via the Admin SDK.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `tokenCipher` (AES-GCM encrypted), `tokenHash` (SHA-256 for equality checks), `slackUserId`/`slackTeamId` (cached from auth.test), and validation timestamps.

#### `users/{uid}/secrets/iosShortcutBearer`

Per-user bearer token hash for iOS Shortcut authentication. No client access. Only Cloud Functions read and write this document via the Admin SDK.

The document shape is defined in the architecture doc (000, section "Firestore schema"). Key fields: `bearerHash` (SHA-256 of the opaque portion of the bearer), `createdAt`, and `lastUsedAt`.

### Indexes

Firestore creates single-field indexes automatically. The following descending-order indexes are defined in `firestore.indexes.json` to support ordered queries:

| Collection path         | Fields                 | Purpose                                                 |
| ----------------------- | ---------------------- | ------------------------------------------------------- |
| `users/{uid}/locations` | `timestamp` descending | Fetch the most recent location for resolver input       |
| `users/{uid}/decisions` | `at` descending        | Display the decision log in reverse chronological order |
| `users/{uid}/rules`     | `priority` descending  | Evaluate rules in priority order during resolution      |

Single-field indexes on document IDs and other scalar fields are created automatically by Firestore.

### Zod schemas

Zod schema file locations follow the project convention described in the architecture doc (000). Each subcollection's schema lives in `packages/schema/src/` and types derive via `z.infer`.

### Data lifecycle and trimming

Trimming thresholds are documented inline with each collection above. The shared `trimCollection` helper (design doc 007) handles the deletion of excess documents.

### Migration policy

For v1 (single user), there is no automated migration tooling. Schema evolution follows these guidelines:

1. Zod schemas are the source of truth. Any schema change starts with updating the Zod definition in `packages/schema`.
2. New optional fields can be added freely. Zod's `.optional()` and `.default()` handle missing fields on read.
3. Field renames or type changes are breaking. For these, write a one-off migration script that reads all affected documents and rewrites them in the new shape. Run the script locally against the production database (or emulator for testing).
4. Document the migration in the relevant design doc and in the PR description.
5. After migration, remove backward-compatibility code in the next release.

This approach is acceptable for a single-user tool. If multi-tenant support is added later, invest in a versioned migration framework.

## Alternatives considered

**Flat document structure instead of subcollections.** Storing all user data (profile, rules, images) in a single document would reduce read counts but makes real-time listeners coarse-grained (any change triggers a full re-read) and bumps into Firestore's 1 MB document size limit as the image and rule count grows. Subcollections provide granular listeners and scale naturally.

**Separate top-level collections with a `userId` field instead of nesting under `users/{uid}`.** Top-level collections like `rules` with a `userId` field would require security rules to filter on `resource.data.userId == request.auth.uid` for every read and write. Nesting under `users/{uid}` makes the ownership implicit in the path, simplifying rules to a single `isOwner(uid)` check.

**Conditions as a separate subcollection instead of an inline array.** Storing each condition as its own document under `rules/{ruleId}/conditions/{conditionId}` would allow independent updates but requires an extra read per rule during evaluation (or a collection group query). Since a rule typically has 1 to 5 conditions and the entire conditions array is always read together, inline storage is simpler and more efficient.

**Automated migration framework from day one.** Tools like Firestore migrations libraries or custom versioning systems were considered. For a single-user v1, the overhead of maintaining migration infrastructure is not justified. One-off scripts are sufficient and can be replaced with a framework if the user base grows.

**Storing image bytes in Firestore instead of Firebase Storage.** Firestore documents have a 1 MB size limit, and avatar images can approach that. Firebase Storage is designed for binary data, supports direct browser uploads, and separates metadata (Firestore) from bytes (Storage) cleanly.

## Open questions

- Should the `decisions` trim threshold (1,000) be configurable per user via the profile document, or is a fixed constant sufficient for v1?
- Should the `locations` trim threshold (500) account for source type (e.g., keep more iOS Shortcut locations than browser locations), or treat all sources equally?
- For the `scheduler.intervalMinutes` field, should there be a minimum value to prevent excessive Cloud Function invocations? The architecture doc defaults to 15 minutes.
- When a breaking schema change lands, should the one-off migration script be committed to the repo (under a `scripts/` directory) or treated as ephemeral and discarded after use?

## Acceptance criteria

- Zod schemas exist in `packages/schema/src/` for every document type: `image.ts`, `rule.ts`, `condition.ts`, `override.ts`, `location.ts`, `decision.ts`.
- All Zod schemas achieve 100% test coverage: valid documents parse successfully, invalid documents (missing required fields, wrong types, extra fields) are rejected with meaningful errors.
- TypeScript types throughout `@heliotrope/web` and `@heliotrope/functions` are derived from Zod schemas via `z.infer`, not manually defined.
- `firestore.indexes.json` contains the three composite indexes: `locations` by `timestamp` descending, `decisions` by `at` descending, `rules` by `priority` descending.
- Firestore security rules match the specification in design doc 001 and cover all subcollection paths defined here.
- Firestore rules tests (using `@firebase/rules-unit-testing`) cover every subcollection for: owner read (allowed), owner write (allowed or denied depending on collection), non-owner access (denied), and unauthenticated access (denied). Coverage target: 100% of documented policies have both an allow and a deny test case.
- Data lifecycle trimming works correctly: writing a 501st location document causes the oldest to be deleted, writing a 1,001st decision document causes the oldest to be deleted.
- External data entering the application (Firestore reads, HTTP bodies) is validated through Zod before use. No `any` types at data boundaries.
- `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass.
- No personal identifiers (emails, UIDs, coordinates) appear in schema definitions, test fixtures, or documentation.
