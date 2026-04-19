import { type ChangeEvent, useRef, useState } from 'react';
import { createPreviewUrl, processImage, revokePreviewUrl } from '../lib/imageProcessing';
import {
  readImageDimensions,
  validateOriginalImage,
  validateProcessedImage,
} from '../lib/imageValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedInfo, setProcessedInfo] = useState<{
    originalWidth: number;
    originalHeight: number;
    processedWidth: number;
    processedHeight: number;
    wasResized: boolean;
    wasCropped: boolean;
    displayName: string;
  } | null>(initialProcessedInfo ? { ...initialProcessedInfo, displayName: 'preview' } : null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearPreview() {
    if (previewUrl && !initialPreviewUrl) {
      revokePreviewUrl(previewUrl);
    }
    setPreviewUrl(null);
    setProcessedBlob(null);
    setProcessedInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    clearPreview();

    let dimensions: { width: number; height: number };
    try {
      dimensions = await readImageDimensions(file);
    } catch {
      setErrors(['Failed to read image. The file may be corrupted.']);
      return;
    }

    const originalResult = validateOriginalImage(file, dimensions);
    if (!originalResult.valid) {
      setErrors(originalResult.errors);
      return;
    }

    let processed;
    try {
      processed = await processImage(file);
    } catch {
      setErrors(['Failed to process image.']);
      return;
    }

    const processedResult = validateProcessedImage(processed.blob);
    if (!processedResult.valid) {
      setErrors(processedResult.errors);
      return;
    }

    const url = createPreviewUrl(processed.blob);
    setPreviewUrl(url);
    setProcessedBlob(processed.blob);
    setProcessedInfo({
      originalWidth: processed.originalWidth,
      originalHeight: processed.originalHeight,
      processedWidth: processed.width,
      processedHeight: processed.height,
      wasResized: processed.wasResized,
      wasCropped: processed.wasCropped,
      displayName: file.name.replace(/\.[^.]+$/, ''),
    });
  }

  async function handleConfirmUpload() {
    if (!processedBlob || !processedInfo) return;

    const imageId = crypto.randomUUID();

    setUploading(true);
    setProgress(0);

    try {
      await onUpload(
        processedBlob,
        imageId,
        processedInfo.displayName,
        { width: processedInfo.processedWidth, height: processedInfo.processedHeight },
        setProgress,
      );
      clearPreview();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Upload failed.']);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const showPreview = previewUrl && processedInfo && !uploading;

  return (
    <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 text-center">
      <p className="mb-3 text-sm text-muted-foreground">
        Upload a PNG or JPEG image (at least 128x128). Large images will be automatically resized.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => void handleFileChange(e)}
        disabled={disabled === true || uploading}
        data-testid="image-file-input"
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
      />

      {showPreview && (
        <div className="mt-4 flex flex-col items-center gap-3" data-testid="image-preview">
          <img
            src={previewUrl}
            alt="Processed preview"
            className="w-32 h-32 rounded-md object-cover border"
          />
          <div className="text-sm text-muted-foreground">
            {processedInfo.wasResized || processedInfo.wasCropped ? (
              <p>
                {processedInfo.originalWidth}x{processedInfo.originalHeight} &rarr;{' '}
                {processedInfo.processedWidth}x{processedInfo.processedHeight}
                {processedInfo.wasCropped ? ' (center-cropped)' : ''}
              </p>
            ) : (
              <p>
                {processedInfo.processedWidth}x{processedInfo.processedHeight} (no changes needed)
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void handleConfirmUpload()}>
              Upload
            </Button>
            <Button size="sm" variant="outline" onClick={clearPreview}>
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
