import { type ChangeEvent, useRef, useState } from 'react';
import { createPreviewUrl, processImage, revokePreviewUrl } from '../lib/imageProcessing';
import {
  ALLOWED_TYPES,
  readImageDimensions,
  validateOriginalImage,
  validateProcessedImage,
} from '../lib/imageValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ProcessedEntry {
  blob: Blob;
  previewUrl: string;
  displayName: string;
  processedWidth: number;
  processedHeight: number;
  originalWidth: number;
  originalHeight: number;
  wasResized: boolean;
  wasCropped: boolean;
}

interface ImageUploaderProps {
  onUpload: (
    blob: Blob,
    imageId: string,
    displayName: string,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
  ) => Promise<void>;
  disabled?: boolean;
  initialErrors?: string[];
  initialUploading?: boolean;
  initialProgress?: number;
  initialPreviewUrl?: string;
  initialProcessedInfo?: {
    originalWidth: number;
    originalHeight: number;
    processedWidth: number;
    processedHeight: number;
    wasResized: boolean;
    wasCropped: boolean;
  };
}

export function ImageUploader({
  onUpload,
  disabled,
  initialErrors = [],
  initialUploading = false,
  initialProgress = 0,
  initialPreviewUrl,
  initialProcessedInfo,
}: ImageUploaderProps) {
  const [errors, setErrors] = useState<string[]>(initialErrors);
  const [uploading, setUploading] = useState(initialUploading);
  const [progress, setProgress] = useState(initialProgress);
  const [entries, setEntries] = useState<ProcessedEntry[]>(() => {
    if (initialPreviewUrl && initialProcessedInfo) {
      return [
        {
          blob: new Blob(),
          previewUrl: initialPreviewUrl,
          displayName: 'preview',
          processedWidth: initialProcessedInfo.processedWidth,
          processedHeight: initialProcessedInfo.processedHeight,
          originalWidth: initialProcessedInfo.originalWidth,
          originalHeight: initialProcessedInfo.originalHeight,
          wasResized: initialProcessedInfo.wasResized,
          wasCropped: initialProcessedInfo.wasCropped,
        },
      ];
    }
    return [];
  });
  const [skippedCount, setSkippedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearPreviews() {
    for (const entry of entries) {
      if (entry.previewUrl !== initialPreviewUrl) {
        revokePreviewUrl(entry.previewUrl);
      }
    }
    setEntries([]);
    setSkippedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrors([]);
    clearPreviews();

    const newEntries: ProcessedEntry[] = [];
    const fileErrors: string[] = [];
    let skipped = 0;

    for (const file of files) {
      // Silently skip non-image files
      if (!ALLOWED_TYPES.includes(file.type)) {
        skipped++;
        continue;
      }

      let dimensions: { width: number; height: number };
      try {
        dimensions = await readImageDimensions(file);
      } catch {
        fileErrors.push(`${file.name}: Failed to read image.`);
        continue;
      }

      const originalResult = validateOriginalImage(file, dimensions);
      if (!originalResult.valid) {
        fileErrors.push(`${file.name}: ${originalResult.errors.join(' ')}`);
        continue;
      }

      let processed;
      try {
        processed = await processImage(file);
      } catch {
        fileErrors.push(`${file.name}: Failed to process image.`);
        continue;
      }

      const processedResult = validateProcessedImage(processed.blob);
      if (!processedResult.valid) {
        fileErrors.push(`${file.name}: ${processedResult.errors.join(' ')}`);
        continue;
      }

      newEntries.push({
        blob: processed.blob,
        previewUrl: createPreviewUrl(processed.blob),
        displayName: file.name.replace(/\.[^.]+$/, ''),
        processedWidth: processed.width,
        processedHeight: processed.height,
        originalWidth: processed.originalWidth,
        originalHeight: processed.originalHeight,
        wasResized: processed.wasResized,
        wasCropped: processed.wasCropped,
      });
    }

    setEntries(newEntries);
    setSkippedCount(skipped);
    if (fileErrors.length > 0) {
      setErrors(fileErrors);
    }
  }

  async function handleConfirmUpload() {
    if (entries.length === 0) return;

    setUploading(true);
    setProgress(0);

    const uploadErrors: string[] = [];
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      const imageId = crypto.randomUUID();
      try {
        await onUpload(
          entry.blob,
          imageId,
          entry.displayName,
          { width: entry.processedWidth, height: entry.processedHeight },
          (fileProgress) => {
            const overall = ((i + fileProgress / 100) / total) * 100;
            setProgress(overall);
          },
        );
      } catch (err) {
        uploadErrors.push(
          `${entry.displayName}: ${err instanceof Error ? err.message : 'Upload failed.'}`,
        );
      }
    }

    clearPreviews();
    setUploading(false);
    setProgress(0);

    if (uploadErrors.length > 0) {
      setErrors(uploadErrors);
    }
  }

  const showPreviews = entries.length > 0 && !uploading;

  return (
    <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 text-center">
      <p className="mb-3 text-sm text-muted-foreground">
        Upload PNG or JPEG images (at least 128x128). Large images will be automatically resized.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        onChange={(e) => void handleFileChange(e)}
        disabled={disabled === true || uploading}
        data-testid="image-file-input"
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
      />

      {showPreviews && (
        <div className="mt-4" data-testid="image-preview">
          <div className="flex flex-wrap justify-center gap-3">
            {entries.map((entry) => (
              <div key={entry.previewUrl} className="flex flex-col items-center gap-1">
                <img
                  src={entry.previewUrl}
                  alt={`Preview: ${entry.displayName}`}
                  className="w-24 h-24 rounded-md object-cover border"
                />
                <span className="text-xs text-muted-foreground truncate max-w-[96px]">
                  {entry.displayName}
                </span>
                {(entry.wasResized || entry.wasCropped) && (
                  <span className="text-xs text-muted-foreground">
                    {entry.originalWidth}x{entry.originalHeight} &rarr; {entry.processedWidth}x
                    {entry.processedHeight}
                  </span>
                )}
              </div>
            ))}
          </div>
          {skippedCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {skippedCount} non-image {skippedCount === 1 ? 'file was' : 'files were'} skipped.
            </p>
          )}
          <div className="flex justify-center gap-2 mt-3">
            <Button size="sm" onClick={() => void handleConfirmUpload()}>
              Upload {entries.length > 1 ? `${entries.length} images` : ''}
            </Button>
            <Button size="sm" variant="outline" onClick={clearPreviews}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="mt-3">
          <Progress value={progress} data-testid="upload-progress-bar" />
          <p className="mt-2 text-sm text-muted-foreground">Uploading... {Math.round(progress)}%</p>
        </div>
      )}
      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-3 text-left">
          <AlertDescription>
            {errors.map((err) => (
              <p key={err} className="text-sm">
                {err}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
