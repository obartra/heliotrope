import { describe, it, expect } from 'vitest';
import { ImageSchema, ImageVariantSchema } from './image.js';

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

const ts = { seconds: 1700000000, nanoseconds: 0 };

const validImage = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  filename: 'avatar.png',
  displayName: 'My Avatar',
  storagePath: 'users/abc/avatars/550e8400-e29b-41d4-a716-446655440000.png',
  contentType: 'image/png',
  bytes: 102400,
  width: 512,
  height: 512,
  tags: ['activity', 'default'],
  createdAt: ts,
  updatedAt: ts,
};

describe('ImageSchema', () => {
  it('parses a valid image document', () => {
    expect(ImageSchema.parse(validImage)).toEqual(validImage);
  });

  it('accepts empty tags array', () => {
    expect(ImageSchema.parse({ ...validImage, tags: [] })).toBeTruthy();
  });

  it('accepts zero bytes', () => {
    expect(ImageSchema.parse({ ...validImage, bytes: 0 })).toBeTruthy();
  });

  it('rejects invalid UUID for id', () => {
    expect(() => ImageSchema.parse({ ...validImage, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects missing filename', () => {
    expect(() => ImageSchema.parse(omit(validImage, 'filename'))).toThrow();
  });

  it('rejects missing displayName', () => {
    expect(() => ImageSchema.parse(omit(validImage, 'displayName'))).toThrow();
  });

  it('rejects missing storagePath', () => {
    expect(() => ImageSchema.parse(omit(validImage, 'storagePath'))).toThrow();
  });

  it('rejects negative bytes', () => {
    expect(() => ImageSchema.parse({ ...validImage, bytes: -1 })).toThrow();
  });

  it('rejects non-integer bytes', () => {
    expect(() => ImageSchema.parse({ ...validImage, bytes: 100.5 })).toThrow();
  });

  it('rejects zero width', () => {
    expect(() => ImageSchema.parse({ ...validImage, width: 0 })).toThrow();
  });

  it('rejects zero height', () => {
    expect(() => ImageSchema.parse({ ...validImage, height: 0 })).toThrow();
  });

  it('rejects negative width', () => {
    expect(() => ImageSchema.parse({ ...validImage, width: -1 })).toThrow();
  });

  it('rejects non-integer width', () => {
    expect(() => ImageSchema.parse({ ...validImage, width: 512.5 })).toThrow();
  });

  it('rejects missing createdAt', () => {
    expect(() => ImageSchema.parse(omit(validImage, 'createdAt'))).toThrow();
  });

  it('rejects invalid createdAt', () => {
    expect(() => ImageSchema.parse({ ...validImage, createdAt: 'not-a-ts' })).toThrow();
  });

  it('rejects non-string tags', () => {
    expect(() => ImageSchema.parse({ ...validImage, tags: [123] })).toThrow();
  });

  it('parses an image document without variants', () => {
    const result = ImageSchema.parse(validImage);
    expect(result.variants).toBeUndefined();
  });

  it('parses an image document with a variants map', () => {
    const withVariants = {
      ...validImage,
      variants: {
        slack: {
          storagePath: 'users/abc/avatars/550e8400_slack.jpg',
          contentType: 'image/jpeg',
          width: 512,
          height: 512,
          bytes: 50000,
        },
      },
    };
    const result = ImageSchema.parse(withVariants);
    expect(result.variants?.slack?.width).toBe(512);
  });

  it('accepts an empty variants map', () => {
    expect(ImageSchema.parse({ ...validImage, variants: {} })).toBeTruthy();
  });
});

describe('ImageVariantSchema', () => {
  it('parses a valid variant', () => {
    const variant = {
      storagePath: 'users/abc/avatars/id_slack.jpg',
      contentType: 'image/jpeg',
      width: 512,
      height: 512,
      bytes: 50000,
    };
    expect(ImageVariantSchema.parse(variant)).toEqual(variant);
  });

  it('rejects variant with zero width', () => {
    expect(() =>
      ImageVariantSchema.parse({
        storagePath: 'x',
        contentType: 'image/jpeg',
        width: 0,
        height: 512,
        bytes: 50000,
      }),
    ).toThrow();
  });

  it('rejects variant with negative bytes', () => {
    expect(() =>
      ImageVariantSchema.parse({
        storagePath: 'x',
        contentType: 'image/jpeg',
        width: 512,
        height: 512,
        bytes: -1,
      }),
    ).toThrow();
  });

  it('rejects variant with missing storagePath', () => {
    expect(() =>
      ImageVariantSchema.parse({
        contentType: 'image/jpeg',
        width: 512,
        height: 512,
        bytes: 50000,
      }),
    ).toThrow();
  });
});
