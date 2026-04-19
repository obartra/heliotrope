import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  MAX_DIMENSION,
  MAX_FILE_SIZE,
  MIN_DIMENSION,
  SLACK_SIZE_LIMIT,
  validateImageFile,
} from './imageValidation';

const square512 = { width: 512, height: 512 };

describe('validateImageFile', () => {
  it('accepts a valid PNG under 1 MB', () => {
    const result = validateImageFile({ type: 'image/png', size: 500_000 }, square512);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('accepts a valid JPEG under 1 MB', () => {
    const result = validateImageFile({ type: 'image/jpeg', size: 500_000 }, square512);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects unsupported file type', () => {
    const result = validateImageFile({ type: 'image/gif', size: 500_000 }, square512);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File must be PNG or JPEG.');
  });

  it('rejects files over 2 MB', () => {
    const result = validateImageFile({ type: 'image/png', size: MAX_FILE_SIZE + 1 }, square512);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/2 MB/);
  });

  it('warns for files over 1 MB but under 2 MB', () => {
    const result = validateImageFile({ type: 'image/png', size: SLACK_SIZE_LIMIT + 1 }, square512);
    expect(result.valid).toBe(true);
    expect(result.warnings[0]).toMatch(/Slack's 1 MB limit/);
  });

  it('rejects dimensions below minimum', () => {
    const result = validateImageFile({ type: 'image/png', size: 1000 }, { width: 64, height: 64 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(new RegExp(`${MIN_DIMENSION}x${MIN_DIMENSION}`));
  });

  it('rejects dimensions above maximum', () => {
    const result = validateImageFile(
      { type: 'image/png', size: 1000 },
      { width: 2048, height: 2048 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(new RegExp(`${MAX_DIMENSION}x${MAX_DIMENSION}`));
  });

  it('rejects when only width is below minimum', () => {
    const result = validateImageFile({ type: 'image/png', size: 1000 }, { width: 64, height: 256 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toContain('This image is not square. Slack may crop it unexpectedly.');
  });

  it('warns for non-square images within valid range', () => {
    const result = validateImageFile(
      { type: 'image/png', size: 500_000 },
      { width: 512, height: 256 },
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('This image is not square. Slack may crop it unexpectedly.');
  });

  it('collects multiple errors', () => {
    const result = validateImageFile(
      { type: 'image/bmp', size: MAX_FILE_SIZE + 1 },
      { width: 10, height: 10 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts exact boundary values', () => {
    const result = validateImageFile(
      { type: 'image/png', size: MAX_FILE_SIZE },
      { width: MAX_DIMENSION, height: MAX_DIMENSION },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts minimum dimension boundary', () => {
    const result = validateImageFile(
      { type: 'image/png', size: 1000 },
      { width: MIN_DIMENSION, height: MIN_DIMENSION },
    );
    expect(result.valid).toBe(true);
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
