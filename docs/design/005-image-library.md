# 005 - Image Library

## Context

The resolver picks a winning image for each evaluation cycle, but the images themselves need a way to get into the system. Users need to upload avatar images, organize them with tags, and manage them over time (rename, replace, delete). The image library is the central catalog that rules reference by `imageId`, so deleting or replacing an image has downstream consequences that the UI must surface clearly.

Slack imposes its own constraints on profile photos (1 MB max, minimum dimensions), and the upload flow should validate what it can on the client side while deferring the final Slack-side validation to the upload attempt itself. Firebase Storage provides per-user file isolation, and Firestore holds the metadata that the rest of the system queries.

This document covers the upload flow, client-side and server-side validation, Storage layout, metadata schema, and the library management UI (list, rename, tag, delete, replace).

## Proposal

### Storage layout

All avatar files live under a per-user prefix in Firebase Storage:

```
users/{uid}/avatars/{imageId}.png
```

The `{imageId}` is a UUID generated at upload time. Even if the original file is a JPEG, it is stored with a `.png` extension for consistency (the `contentType` field in the metadata doc records the actual MIME type). Storage rules enforce that only the owning user can read or write files under their prefix (see design doc 001 for the rule definition).

### Image metadata document

Each uploaded image has a corresponding Firestore document at `users/{uid}/images/{imageId}`:

The image metadata document shape is defined in the architecture doc (000, section 'Firestore schema'). Key fields: `id` (UUID, matches Storage filename and document ID), `storagePath`, `displayName` (user-editable), `tags` (freeform strings for UI grouping), and dimension/size fields for validation display.

### Upload flow

1. User selects a file via the `ImageUploader` component (`apps/web/src/components/ImageUploader.tsx`).
2. Client-side validation runs immediately:
   - **File type**: must be PNG or JPEG. Other formats are rejected with an inline error.
   - **File size**: must be at most 2 MB. Files over 2 MB are rejected. Files over 1 MB but under 2 MB show a warning: "This image exceeds Slack's 1 MB limit. It will upload to the library but may fail when Slack tries to use it."
   - **Dimensions**: the client reads the image into a canvas to measure width and height. Minimum 128x128, maximum 1024x1024. Images outside this range are rejected. Non-square images show a warning: "This image is not square. Slack may crop it unexpectedly."
3. A UUID is generated for `imageId`.
4. The file bytes are uploaded to `users/{uid}/avatars/{imageId}.png` via the Firebase Storage SDK. A progress indicator is shown during upload.
5. On successful upload, a metadata document is written to `users/{uid}/images/{imageId}` with the fields described above. The `displayName` defaults to the original filename without its extension. The `tags` array starts empty (the user can add tags after upload).
6. The library view refreshes via Firestore snapshot listener and the new image appears.

### Library view

The `/images` page displays all images for the current user, grouped by tag. Images with no tags appear in an "Untagged" group. Within each group, images are displayed as thumbnail cards showing:

- Thumbnail preview (scaled to fit)
- `displayName`
- File size in human-readable form
- Dimensions

The view supports four states, each with a corresponding Storybook story:

- **Empty**: no images uploaded. Shows an upload prompt.
- **Populated**: one or more images displayed in tag groups.
- **Loading**: skeleton placeholders while Firestore data loads.
- **Error**: error banner if the Firestore listener fails.

Suggested tags for UI grouping: "activity", "location", "holiday", "weather", "event". These are suggestions shown in a tag autocomplete, not a fixed enum. Users can type any freeform tag.

### Rename

Renaming changes only the `displayName` field on the metadata document. The Storage file path and `filename` remain unchanged. The `updatedAt` timestamp is bumped. This is a single Firestore field update.

### Tag management

Tags are edited inline on the image card or in a detail panel. The `tags` array on the metadata document is replaced wholesale on save. The `updatedAt` timestamp is bumped.

### Delete

Deleting an image requires care because rules may reference it via `imageId`.

1. User clicks delete on an image card.
2. The UI queries `users/{uid}/rules` for any rule whose `imageId` matches the image being deleted.
3. If referencing rules exist, a confirmation dialog lists them by name and offers two options:
   - **Delete referencing rules**: deletes the image and all rules that reference it.
   - **Reassign rules**: opens an image picker so the user can choose a replacement image. All referencing rules are updated to point to the new `imageId`, then the original image is deleted.
4. If no referencing rules exist, a simple confirmation dialog asks "Delete this image?" with confirm/cancel.
5. On confirmation, the Storage file is deleted first, then the Firestore metadata document.
6. If the deleted image is the user's `defaultImageId` in their profile, the profile's `defaultImageId` is set to `null` and a notice is shown.

### Replace bytes

Replacing an image's bytes allows the user to upload a new file to the same `imageId` and Storage path. This is useful when the user wants to update an avatar without changing rule references.

1. User selects "Replace" on an existing image card.
2. The same client-side validation from the upload flow runs on the new file.
3. The new file is uploaded to the same Storage path (`users/{uid}/avatars/{imageId}.png`), overwriting the previous file.
4. The metadata document is updated with the new `bytes`, `width`, `height`, `contentType`, and `filename`. The `updatedAt` timestamp is bumped.
5. The next scheduled `syncAvatar` run detects the changed hash and uploads the new image to Slack.

### Seed data

The `seed/avatars/` directory contains 26 PNG files. On first sign-in, if the user has no images and no rules, the UI offers to run a seed import. The import:

1. Uploads each PNG to Storage under the user's prefix.
2. Creates a metadata document for each image. Tags are inferred from the filename (for example, `rainy-day.png` gets the tag "weather", `brazil.png` gets "location"). The mapping from filename to tags lives in `seed/rules.seed.example.json`.
3. Sets `default.png` as the user's `defaultImageId`.

The seed data file `seed/rules.seed.json` is excluded from version control via `.gitignore`. A template file `seed/rules.seed.example.json` provides the structure with placeholder values.

## Alternatives considered

**Auto-resize uploads that exceed 1024x1024.** Client-side canvas resizing would allow users to upload any size image. This was rejected because resizing introduces quality loss that the user cannot preview before it reaches Slack. Rejecting oversized images with a clear error gives the user control over how the image is prepared. This can be revisited if it proves too inconvenient in practice.

**Store images in their original format instead of normalizing the extension.** Keeping the original extension (`.png` or `.jpg`) would be more transparent. The normalized `.png` extension was chosen so that Storage paths are predictable and the resolver does not need to guess extensions when constructing download paths. The actual MIME type is preserved in the `contentType` metadata field.

**Server-side validation via a Cloud Function upload trigger.** A Storage trigger (`onObjectFinalized`) could validate dimensions and file size on the server and delete invalid uploads automatically. This was rejected for v1 because client-side validation covers the same checks with faster feedback, and adding a trigger introduces latency and complexity. If users find ways to bypass client validation (for example, by using the Firebase console directly), a server-side trigger can be added later without schema changes.

**Tag taxonomy enforced by an enum.** A fixed set of tag values would simplify grouping logic. Freeform tags were chosen instead because the set of useful tags depends on the user's personal context and will evolve over time. The suggested tags ("activity", "location", "holiday", "weather", "event") appear in the autocomplete but do not constrain input.

**Soft-delete with a `deletedAt` field instead of hard delete.** Soft delete would allow undoing accidental deletions. It was rejected because the image library is small (dozens of images, not thousands), the delete flow already includes a confirmation step with rule-reference warnings, and soft delete adds query complexity (every query must filter out deleted images). Hard delete with confirmation is sufficient for v1.

## Open questions

- Should the upload flow auto-resize images that exceed 1024x1024 instead of rejecting them? Current proposal: reject and let the user resize externally.
- Should replaced images preserve the original `createdAt` or reset it? Current proposal: preserve `createdAt`, bump only `updatedAt`.
- Should the tag autocomplete draw from all tags already in use across the user's library, in addition to the suggested tags? Current proposal: yes, merge both lists.

## Acceptance criteria

- `ImageUploader` component validates file type (PNG or JPEG only), file size (reject over 2 MB, warn over 1 MB), and dimensions (reject below 128x128 or above 1024x1024, warn if not square).
- Upload writes the file to `users/{uid}/avatars/{imageId}.png` in Firebase Storage and creates a metadata document at `users/{uid}/images/{imageId}` in Firestore.
- The Zod schema in `packages/schema/src/image.ts` validates the metadata document structure, and `packages/schema` maintains 100% test coverage.
- Library view at `/images` displays images grouped by tag, with an "Untagged" group for images without tags.
- Rename updates only `displayName` and `updatedAt` on the metadata document.
- Delete checks for referencing rules and shows a confirmation dialog listing them. The dialog offers to delete referencing rules or reassign them to a different image.
- Delete of the current `defaultImageId` sets the profile's `defaultImageId` to `null` and shows a notice.
- Replace bytes uploads a new file to the same Storage path and updates `bytes`, `width`, `height`, `contentType`, `filename`, and `updatedAt` on the metadata document.
- Storybook stories exist for `ImageUploader` (idle, uploading, validation error, warning) and the `Images` page (empty, populated, loading, error).
- Cypress E2E test covers the upload flow: select a valid image, verify it appears in the library.
- Cypress E2E test covers the delete flow: delete an image that is referenced by a rule, verify the rule-reference warning dialog appears, confirm deletion, verify the image and referencing rule are removed.
- Cypress E2E test covers the delete-with-reassign flow: delete a referenced image, choose reassignment, verify the rule now points to the new image.
- Seed import uploads all 26 PNGs from `seed/avatars/` and creates metadata documents with tags inferred from filenames.
- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm test` passes with image-related unit tests included.
- No personal identifiers appear in the codebase. Seed coordinate data lives only in `seed/rules.seed.json`, which is excluded from version control.
