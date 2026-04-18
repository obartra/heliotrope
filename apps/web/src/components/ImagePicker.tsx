import { Link } from 'react-router-dom';
import { groupByTag } from '@/lib/imageUtils';
import type { ImageWithUrl } from '@/lib/useImages';
import { cn } from '@/lib/utils';

interface ImagePickerProps {
  images: ImageWithUrl[];
  selectedImageId: string | null;
  onSelect: (imageId: string) => void;
}

export function ImagePicker({ images, selectedImageId, onSelect }: ImagePickerProps) {
  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No images in your library.{' '}
        <Link to="/images" className="underline text-primary">
          Upload images first
        </Link>
        .
      </p>
    );
  }

  const groups = groupByTag(images);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.tag}>
          <p className="text-xs font-medium text-muted-foreground mb-2">{group.tag}</p>
          <div className="flex flex-wrap gap-2">
            {group.images.map((img) => (
              <button
                key={img.data.id}
                type="button"
                onClick={() => onSelect(img.data.id)}
                className={cn(
                  'relative rounded-md overflow-hidden border-2 transition-colors',
                  'w-16 h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedImageId === img.data.id
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-transparent hover:border-muted-foreground/30',
                )}
                title={img.data.displayName}
              >
                <img
                  src={img.downloadUrl}
                  alt={img.data.displayName}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
