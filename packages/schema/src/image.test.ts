import { describe, it, expect } from 'vitest';
import { ImageSchema } from './image.js';

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
});
