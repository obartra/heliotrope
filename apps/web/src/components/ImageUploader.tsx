import { type ChangeEvent, useRef, useState } from 'react';
import { readImageDimensions, validateImageFile } from '../lib/imageValidation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface ImageUploaderProps {
  onUpload: (
    file: File,
    imageId: string,
    displayName: string,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
  ) => Promise<void>;
  disabled?: boolean;
  initialErrors?: string[];
  initialWarnings?: string[];
  initialUploading?: boolean;
  initialProgress?: number;
}

export function ImageUploader({
  onUpload,
  disabled,
  initialErrors = [],
  initialWarnings = [],
  initialUploading = false,
  initialProgress = 0,
}: ImageUploaderProps) {
  const [errors, setErrors] = useState<string[]>(initialErrors);
  const [warnings, setWarnings] = useState<string[]>(initialWarnings);
  const [uploading, setUploading] = useState(initialUploading);
  const [progress, setProgress] = useState(initialProgress);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setWarnings([]);

    let dimensions: { width: number; height: number };
    try {
      dimensions = await readImageDimensions(file);
    } catch {
      setErrors(['Failed to read image. The file may be corrupted.']);
      return;
    }

    const result = validateImageFile(file, dimensions);
    setErrors(result.errors);
    setWarnings(result.warnings);

    if (!result.valid) return;

    const imageId = crypto.randomUUID();
    const displayName = file.name.replace(/\.[^.]+$/, '');

    setUploading(true);
    setProgress(0);

    try {
      await onUpload(file, imageId, displayName, dimensions, setProgress);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Upload failed.']);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 text-center">
      <p className="mb-3 text-sm text-muted-foreground">
        Upload a PNG or JPEG image (128x128 to 1024x1024, max 2 MB)
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
      {warnings.length > 0 && (
        <Alert variant="warning" className="mt-3 text-left">
          <AlertDescription>
            {warnings.map((warn) => (
              <p key={warn} className="text-sm">
                {warn}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
