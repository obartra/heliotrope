# 012 - Image Optimization and System-Specific Variants

## Context

The current upload flow stores images exactly as the user provides them, with client-side validation capping dimensions at 1024x1024 and file size at 2 MB. When `syncAvatar` runs, it downloads the stored image bytes and sends them directly to Slack's `users.setPhoto` API.

This creates two problems:

1. **Unnecessarily restrictive uploads.** Users must manually resize images before uploading. A phone photo or AI-generated avatar will almost always exceed 1024x1024 and must be resized externally.
2. **No path to multi-system support.** When we add targets beyond Slack (Google Workspace, Teams, Discord, etc.), each will have different ideal dimensions and file-size limits. Storing only the user's original upload forces re-processing at sync time with no caching, or requires the user to upload multiple copies.

The goal is to store a single canonical image that is the "strict superset" of all target systems, then generate and cache optimized variants per system. The canonical image should be high quality but not wastefully large (a 4000x4000 photo scaled to a profile picture is wasted storage and bandwidth).

## Proposal

### Canonical image

On upload, the client processes the image to produce a **canonical version** before uploading to Storage:

- **Max dimensions: 1024x1024.** Images larger than 1024 on either axis are downscaled proportionally so the longest side is 1024, then center-cropped to a square. This is the superset size: no current or foreseeable profile-photo system requires more than 1024x1024.
- **Format: PNG.** Lossless, consistent with current behavior.
- **No minimum dimension change.** 128x128 minimum remains. Images below this are too small for any profile system.
- **Max file size: 2 MB.** After resize, if the file still exceeds 2 MB (unlikely at 1024x1024 PNG), it is rejected.

The key change: the uploader now **accepts images of any size** and automatically downscales them, rather than rejecting anything over 1024x1024. The user sees a preview of the processed result before confirming.

### Client-side processing pipeline

When the user selects a file:

1. Read the file into an `<img>` element.
2. If either dimension exceeds 1024, draw onto a canvas scaled so the longest side is 1024.
3. If non-square, center-crop to a square (after scaling). Show a preview with a crop indicator so the user knows what will be kept.
4. Export the canvas as PNG via `canvas.toBlob('image/png')`.
5. Validate the result (file size check, minimum dimension check).
6. Upload the processed blob, not the original file.

JPEG inputs are converted to PNG during this process (matching existing behavior where all stored files use `.png` extension).

### System-specific variants

Each target system has a **variant spec** defining its ideal output:

| System | Variant key | Dimensions | Format | Max size | Notes                                                          |
| ------ | ----------- | ---------- | ------ | -------- | -------------------------------------------------------------- |
| Slack  | `slack`     | 512x512    | JPEG   | 1 MB     | Slack recommends 512x512. JPEG keeps file size well under 1 MB |

Future systems (Google, Teams, etc.) add rows to this table.

### Variant generation and storage

Variants are generated **server-side at upload time** (not at sync time) to avoid repeated processing on every 15-minute cycle.

When the canonical image is written to Storage, a Cloud Function Storage trigger (`onObjectFinalized`) runs:

1. Downloads the canonical image from `users/{uid}/avatars/{imageId}.png`.
2. For each variant spec, resizes and re-encodes the image (e.g., 512x512 JPEG at quality 85 for Slack).
3. Writes each variant to `users/{uid}/avatars/{imageId}_{variant}.{ext}` (e.g., `{imageId}_slack.jpg`).
4. Updates the image metadata document with a `variants` map recording each variant's `storagePath`, `width`, `height`, `bytes`, and `contentType`.

If a variant already exists at the same path (e.g., after a replace-bytes operation), it is overwritten.

### Storage layout (updated)

```
users/{uid}/avatars/{imageId}.png            # canonical (up to 1024x1024 PNG)
users/{uid}/avatars/{imageId}_slack.jpg       # Slack-optimized (512x512 JPEG)
users/{uid}/avatars/{imageId}_google.jpg      # (future) Google-optimized
```

### Schema changes

The `Image` metadata document gains an optional `variants` map:

```typescript
export const ImageVariantSchema = z.object({
  storagePath: z.string(),
  contentType: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
});

export const ImageSchema = z.object({
  // ... existing fields unchanged ...
  variants: z.record(z.string(), ImageVariantSchema).optional(),
});
```

### Sync pipeline changes

`evaluateAndUpload` changes from downloading the canonical image to downloading the system-specific variant:

```typescript
// Before
const file = storageBucket.file(`users/${uid}/avatars/${imageId}.png`);

// After
const variantPath = imageDoc.variants?.slack?.storagePath ?? `users/${uid}/avatars/${imageId}.png`; // fallback for pre-migration images
const file = storageBucket.file(variantPath);
```

The hash-based dedup continues to work: the variant bytes produce a stable hash, and the hash only changes when the variant is regenerated (which happens when the canonical image changes).

### Delete and replace updates

- **Delete:** When an image is deleted, all variant files in Storage are deleted alongside the canonical file.
- **Replace bytes:** When canonical bytes are replaced, the Storage trigger regenerates all variants automatically.

### Migration

Existing images have no variants. The sync pipeline falls back to the canonical file when no variant exists. A one-time migration Cloud Function can be run to backfill variants for all existing images, but it is not required for correctness.

### Server-side image processing

The variant generation function needs an image processing library. Options:

- **sharp:** Fast, well-maintained, handles resize + format conversion. Adds a native dependency but works in Cloud Functions Node.js runtime.
- **Canvas (node-canvas):** Would mirror the client-side approach but is heavier and less suited to simple resize/encode.

Recommendation: **sharp**. It is the standard choice for server-side image processing in Node.js, handles PNG-to-JPEG conversion and resizing in a single pipeline call, and is well-supported in Cloud Functions.

## Alternatives considered

**Generate variants at sync time instead of upload time.** This would avoid storing variant files but means re-processing every 15 minutes for every connected user. Given that images change rarely (uploads are infrequent) while syncs run continuously, generating on upload is far more efficient.

**Let the client generate variants too.** The client could produce both the canonical and variant blobs locally. This was rejected because adding a new target system would require a client update and re-upload of all images, whereas server-side generation can retroactively process existing images.

**Store the original unmodified upload as the canonical.** This would preserve maximum quality but wastes storage (a 4000x4000 phone photo is ~16 MB as PNG) and makes variant generation slower. 1024x1024 is more than sufficient as the source for any profile photo system.

**Use WebP or AVIF for variants.** Modern formats would produce smaller files, but Slack's API documentation only mentions PNG, JPEG, and GIF. Sticking with JPEG for variants ensures compatibility with all current targets.

## Open questions

- Should the client-side crop be user-adjustable (drag to reposition the crop area) or always center-crop? Current proposal: center-crop with preview, revisit if users find it limiting.
- Should variant generation be configurable per-user (e.g., a user might want 256x256 for a specific system)? Current proposal: no, use fixed specs per system. Per-user overrides add complexity with no clear use case.
- Should the canonical image accept non-square inputs and store them as-is, deferring cropping to variant generation? Current proposal: crop to square at upload time so the canonical is always square and all variants are derived from the same crop.

## Acceptance criteria

- `ImageUploader` accepts images of any size and downscales to 1024x1024 max on the client before uploading.
- Non-square images are center-cropped to square on the client with a preview shown before upload.
- JPEG inputs are converted to PNG for canonical storage.
- A Cloud Function Storage trigger generates system-specific variants on canonical image upload.
- Slack variant: 512x512 JPEG at quality 85, stored at `users/{uid}/avatars/{imageId}_slack.jpg`.
- `Image` schema includes an optional `variants` map with per-variant metadata.
- `evaluateAndUpload` reads the Slack variant (falling back to canonical for pre-migration images).
- Delete and replace flows clean up / regenerate variant files.
- `sharp` is used for server-side image processing.
- Storybook stories for the updated uploader show the resize/crop preview.
- Unit tests cover the variant generation logic.
- Integration tests verify the Storage trigger writes variant files and updates the metadata document.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass.
