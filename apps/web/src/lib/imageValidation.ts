export const ALLOWED_TYPES: readonly string[] = ['image/png', 'image/jpeg'];
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const SLACK_SIZE_LIMIT = 1 * 1024 * 1024;
export const MIN_DIMENSION = 128;
export const MAX_DIMENSION = 1024;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateImageFile(
  file: { type: string; size: number },
  dimensions: { width: number; height: number },
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push('File must be PNG or JPEG.');
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push('File must be at most 2 MB.');
  } else if (file.size > SLACK_SIZE_LIMIT) {
    warnings.push(
      "This image exceeds Slack's 1 MB limit. It will upload to the library but may fail when Slack tries to use it.",
    );
  }

  if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
    errors.push(`Image must be at least ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`);
  }

  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    errors.push(`Image must be at most ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`);
  }

  if (dimensions.width !== dimensions.height) {
    warnings.push('This image is not square. Slack may crop it unexpectedly.');
  }

  return { valid: errors.length === 0, errors, warnings };
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
