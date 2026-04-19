import type { ImageVariant } from '@heliotrope/schema';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { StorageEvent } from 'firebase-functions/v2/storage';
import { generateAllVariants } from './generateVariants.js';
import { VARIANT_SPECS } from './variantSpecs.js';

// Only process canonical images, not variants (which contain an underscore before the variant key)
const CANONICAL_PATH_REGEX = /^users\/([^/]+)\/avatars\/([^/_]+)\.png$/;

export async function handleCanonicalUploaded(event: StorageEvent): Promise<void> {
  const filePath = event.data.name;
  if (!filePath) return;

  const match = CANONICAL_PATH_REGEX.exec(filePath);
  if (!match) return;

  const uid = match[1];
  const imageId = match[2];
  if (!uid || !imageId) return;

  const bucket = getStorage().bucket();

  const [canonicalBytes] = await bucket.file(filePath).download();

  const variants = await generateAllVariants(canonicalBytes, VARIANT_SPECS);

  const variantsMap: Record<string, ImageVariant> = {};

  for (const variant of variants) {
    const spec = VARIANT_SPECS.find((s) => s.key === variant.key);
    if (!spec) continue;

    const variantPath = `users/${uid}/avatars/${imageId}_${variant.key}.${spec.extension}`;
    const variantFile = bucket.file(variantPath);
    await variantFile.save(variant.buffer, {
      metadata: { contentType: variant.contentType },
    });

    variantsMap[variant.key] = {
      storagePath: variantPath,
      contentType: variant.contentType,
      width: variant.width,
      height: variant.height,
      bytes: variant.bytes,
    };
  }

  const db = getFirestore();
  await db.doc(`users/${uid}/images/${imageId}`).update({
    variants: variantsMap,
  });
}
