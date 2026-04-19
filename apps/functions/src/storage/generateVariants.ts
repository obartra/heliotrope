import sharp from 'sharp';
import type { VariantSpec } from './variantSpecs.js';

export interface GeneratedVariant {
  key: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  bytes: number;
}

export async function generateVariant(
  canonicalBytes: Buffer,
  spec: VariantSpec,
): Promise<GeneratedVariant> {
  let pipeline = sharp(canonicalBytes).resize(spec.width, spec.height, {
    fit: 'cover',
    position: 'centre',
  });

  if (spec.format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: spec.quality ?? 85 });
  } else {
    pipeline = pipeline.png();
  }

  const buffer = await pipeline.toBuffer();
  return {
    key: spec.key,
    buffer,
    contentType: spec.contentType,
    width: spec.width,
    height: spec.height,
    bytes: buffer.length,
  };
}

export async function generateAllVariants(
  canonicalBytes: Buffer,
  specs: readonly VariantSpec[],
): Promise<GeneratedVariant[]> {
  const results: GeneratedVariant[] = [];
  for (const spec of specs) {
    results.push(await generateVariant(canonicalBytes, spec));
  }
  return results;
}
