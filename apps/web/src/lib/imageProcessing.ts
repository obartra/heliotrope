const CANONICAL_MAX_DIMENSION = 1024;

export interface CropRegion {
  sx: number;
  sy: number;
  sSize: number;
  outputSize: number;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasResized: boolean;
  wasCropped: boolean;
}

/**
 * Computes the crop region for center-cropping and downscaling an image
 * to a square at most maxDimension x maxDimension.
 */
export function computeCropRegion(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number = CANONICAL_MAX_DIMENSION,
): CropRegion {
  // Center-crop to square based on the shorter side
  const sSize = Math.min(originalWidth, originalHeight);
  const sx = Math.floor((originalWidth - sSize) / 2);
  const sy = Math.floor((originalHeight - sSize) / 2);

  // Output size is the square size, capped at maxDimension
  const outputSize = Math.min(sSize, maxDimension);

  return { sx, sy, sSize, outputSize };
}

/**
 * Processes an image file: downscales to fit within 1024x1024 and center-crops to square.
 * Always exports as PNG.
 */
export function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { sx, sy, sSize, outputSize } = computeCropRegion(img.naturalWidth, img.naturalHeight);

      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas 2d context'));
        return;
      }

      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to export canvas to PNG'));
          return;
        }
        resolve({
          blob,
          width: outputSize,
          height: outputSize,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
          wasResized: sSize > outputSize,
          wasCropped: img.naturalWidth !== img.naturalHeight,
        });
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
