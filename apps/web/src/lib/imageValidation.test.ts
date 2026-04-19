import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  MAX_FILE_SIZE,
  MIN_DIMENSION,
  validateOriginalImage,
  validateProcessedImage,
} from './imageValidation';

describe('validateOriginalImage', () => {
  it('accepts a valid PNG', () => {
    const result = validateOriginalImage({ type: 'image/png' }, { width: 512, height: 512 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a valid JPEG', () => {
    const result = validateOriginalImage({ type: 'image/jpeg' }, { width: 512, height: 512 });
    expect(result.valid).toBe(true);
  });

  it('rejects unsupported file type', () => {
    const result = validateOriginalImage({ type: 'image/gif' }, { width: 512, height: 512 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File must be PNG or JPEG.');
  });

  it('rejects dimensions below minimum', () => {
    const result = validateOriginalImage({ type: 'image/png' }, { width: 64, height: 64 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(new RegExp(`${MIN_DIMENSION}x${MIN_DIMENSION}`));
  });

  it('rejects when only width is below minimum', () => {
    const result = validateOriginalImage({ type: 'image/png' }, { width: 64, height: 256 });
    expect(result.valid).toBe(false);
  });

  it('accepts large images (auto-resize handles them)', () => {
    const result = validateOriginalImage({ type: 'image/png' }, { width: 4000, height: 3000 });
    expect(result.valid).toBe(true);
  });

  it('accepts non-square images (auto-crop handles them)', () => {
    const result = validateOriginalImage({ type: 'image/png' }, { width: 800, height: 400 });
    expect(result.valid).toBe(true);
  });

  it('accepts minimum dimension boundary', () => {
    const result = validateOriginalImage(
      { type: 'image/png' },
      { width: MIN_DIMENSION, height: MIN_DIMENSION },
    );
    expect(result.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const result = validateOriginalImage({ type: 'image/bmp' }, { width: 10, height: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validateProcessedImage', () => {
  it('accepts a blob under 2 MB', () => {
    const result = validateProcessedImage({ size: 500_000 });
    expect(result.valid).toBe(true);
  });

  it('accepts a blob at exactly 2 MB', () => {
    const result = validateProcessedImage({ size: MAX_FILE_SIZE });
    expect(result.valid).toBe(true);
  });

  it('rejects a blob over 2 MB', () => {
    const result = validateProcessedImage({ size: MAX_FILE_SIZE + 1 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/2 MB/);
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1_572_864)).toBe('1.5 MB');
  });

  it('formats zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats exactly 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats exactly 1 MB', () => {
    expect(formatFileSize(1_048_576)).toBe('1.0 MB');
  });
});
