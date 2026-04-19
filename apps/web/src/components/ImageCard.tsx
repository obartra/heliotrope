import { type ChangeEvent, useRef, useState } from 'react';
import { formatFileSize, readImageDimensions, validateImageFile } from '../lib/imageValidation';
import type { ImageWithUrl } from '../lib/useImages';
import { TagEditor } from './TagEditor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface ImageCardProps {
  image: ImageWithUrl;
  allTags: string[];
  onRename: (displayName: string) => void;
  onDelete: () => void;
  onReplace: (
    file: File,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
  ) => Promise<void>;
  onTagsChange: (tags: string[]) => void;
}

export function ImageCard({
  image,
  allTags,
  onRename,
  onDelete,
  onReplace,
  onTagsChange,
}: ImageCardProps) {
  const { data, downloadUrl } = image;
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(data.displayName);
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  function handleRenameSubmit() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== data.displayName) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  async function handleReplace(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReplaceError(null);

    let dimensions: { width: number; height: number };
    try {
      dimensions = await readImageDimensions(file);
    } catch {
      setReplaceError('Failed to read image.');
      return;
    }

    const result = validateImageFile(file, dimensions);
    if (!result.valid) {
      setReplaceError(result.errors.join(' '));
      return;
    }

    setReplacing(true);
    setReplaceProgress(0);

    try {
      await onReplace(file, dimensions, setReplaceProgress);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Replace failed.');
    } finally {
      setReplacing(false);
      setReplaceProgress(0);
      if (replaceInputRef.current) {
        replaceInputRef.current.value = '';
      }
    }
  }

  return (
    <Card className="overflow-hidden" data-testid={`image-card-${data.id}`}>
      {downloadUrl ? (
        <img
          src={downloadUrl}
          alt={data.displayName}
          className="w-full aspect-square object-cover block"
        />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm">
          No preview
        </div>
      )}

      <div className="p-3">
        {editing ? (
          <div className="flex gap-1 mb-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setEditing(false);
                  setEditName(data.displayName);
                }
              }}
              aria-label="Image name"
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button variant="ghost" size="sm" onClick={handleRenameSubmit}>
              Save
            </Button>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold truncate" data-testid="image-display-name">
              {data.displayName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setEditing(true)}
            >
              Rename
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-2" data-testid="image-meta">
          {formatFileSize(data.bytes)} &middot; {data.width}x{data.height}
        </p>

        <TagEditor tags={data.tags} allTags={allTags} onChange={onTagsChange} />

        <div className="flex gap-3 mt-2">
          <Button variant="ghost" size="sm" className="text-xs h-7 relative" asChild>
            <label>
              Replace
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => void handleReplace(e)}
                className="sr-only"
              />
            </label>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid="delete-image-btn"
          >
            Delete
          </Button>
        </div>

        {replacing && <Progress value={replaceProgress} className="mt-2 h-1" />}

        {replaceError && (
          <p role="alert" className="text-xs text-destructive mt-2">
            {replaceError}
          </p>
        )}
      </div>
    </Card>
  );
}
