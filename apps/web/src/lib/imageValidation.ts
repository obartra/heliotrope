export const ALLOWED_TYPES: readonly string[] = ['image/png', 'image/jpeg'];
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const MIN_DIMENSION = 128;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates the original image before processing.
 * Checks file type and minimum dimensions. Large images are accepted
 * since the processing pipeline will downscale them.
 */
export function validateOriginalImage(
  file: { type: string },
  dimensions: { width: number; height: number },
): ValidationResult {
  const errors: string[] = [];

  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push('File must be PNG or JPEG.');
  }

  if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
    errors.push(`Image must be at least ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`);
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Validates the processed image blob before upload.
 * Checks file size only since processing guarantees dimensions and format.
 */
export function validateProcessedImage(blob: { size: number }): ValidationResult {
  const errors: string[] = [];

  if (blob.size > MAX_FILE_SIZE) {
    errors.push('Processed image exceeds 2 MB. Try a simpler image.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error('Failed to read image dimensions'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
