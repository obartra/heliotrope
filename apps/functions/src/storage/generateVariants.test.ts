import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generateAllVariants, generateVariant } from './generateVariants.js';
import type { VariantSpec } from './variantSpecs.js';

async function createTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 64, b: 32 },
    },
  })
    .png()
    .toBuffer();
}

const slackSpec: VariantSpec = {
  key: 'slack',
  width: 512,
  height: 512,
  format: 'jpeg',
  quality: 85,
  extension: 'jpg',
  contentType: 'image/jpeg',
};

describe('generateVariant', () => {
  it('produces a JPEG at the specified dimensions', async () => {
    const png = await createTestPng(1024, 1024);
    const result = await generateVariant(png, slackSpec);

    expect(result.key).toBe('slack');
    expect(result.contentType).toBe('image/jpeg');
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.bytes).toBe(result.buffer.length);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('downscales a larger image', async () => {
    const png = await createTestPng(2048, 2048);
    const result = await generateVariant(png, slackSpec);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('upscales a smaller image to fill the target', async () => {
    const png = await createTestPng(128, 128);
    const result = await generateVariant(png, slackSpec);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('produces a PNG variant when format is png', async () => {
    const pngSpec: VariantSpec = {
      key: 'test-png',
      width: 256,
      height: 256,
      format: 'png',
      extension: 'png',
      contentType: 'image/png',
    };

    const png = await createTestPng(1024, 1024);
    const result = await generateVariant(png, pngSpec);

    expect(result.contentType).toBe('image/png');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(256);
  });
});

describe('generateAllVariants', () => {
  it('generates a variant for each spec', async () => {
    const png = await createTestPng(1024, 1024);
    const results = await generateAllVariants(png, [slackSpec]);
    expect(results).toHaveLength(1);
    expect(results[0]?.key).toBe('slack');
  });

  it('returns empty array for empty specs', async () => {
    const png = await createTestPng(128, 128);
    const results = await generateAllVariants(png, []);
    expect(results).toHaveLength(0);
  });
});
