import type { Rule } from '@heliotrope/schema';
import { useMemo, useState } from 'react';
import { DeleteImageDialog } from '../components/DeleteImageDialog';
import { ImageCard } from '../components/ImageCard';
import { ImageUploader } from '../components/ImageUploader';
import { groupByTag } from '../lib/imageUtils';
import type { ImageWithUrl } from '../lib/useImages';
import { useImages } from '../lib/useImages';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export interface ImagesViewProps {
  images: ImageWithUrl[];
  loading: boolean;
  error: string | null;
  onUpload: (
    blob: Blob,
    imageId: string,
    displayName: string,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
  ) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
  onDeleteImageAndRules: (imageId: string) => Promise<void>;
  onReassignAndDelete: (fromImageId: string, toImageId: string) => Promise<void>;
  onRename: (imageId: string, displayName: string) => Promise<void>;
  onUpdateTags: (imageId: string, tags: string[]) => Promise<void>;
  onReplace: (
    imageId: string,
    blob: Blob,
    dimensions: { width: number; height: number },
    onProgress: (progress: number) => void,
  ) => Promise<void>;
  getReferencingRules: (imageId: string) => Promise<Rule[]>;
}

export function ImagesView({
  images,
  loading,
  error,
  onUpload,
  onDelete,
  onDeleteImageAndRules,
  onReassignAndDelete,
  onRename,
  onUpdateTags,
  onReplace,
  getReferencingRules,
}: ImagesViewProps) {
  const [deletingImage, setDeletingImage] = useState<ImageWithUrl | null>(null);
  const [referencingRules, setReferencingRules] = useState<Rule[]>([]);

  const allTags = useMemo(
    () => Array.from(new Set(images.flatMap((img) => img.data.tags))),
    [images],
  );
  const groups = useMemo(() => groupByTag(images), [images]);

  async function handleDeleteClick(img: ImageWithUrl) {
    const rules = await getReferencingRules(img.data.id);
    setReferencingRules(rules);
    setDeletingImage(img);
  }

  async function handleDeleteConfirm() {
    if (!deletingImage) return;
    if (referencingRules.length === 0) {
      await onDelete(deletingImage.data.id);
    }
    setDeletingImage(null);
  }

  async function handleDeleteWithRules() {
    if (!deletingImage) return;
    await onDeleteImageAndRules(deletingImage.data.id);
    setDeletingImage(null);
  }

  async function handleReassign(newImageId: string) {
    if (!deletingImage) return;
    await onReassignAndDelete(deletingImage.data.id, newImageId);
    setDeletingImage(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-10">
        <h1 className="text-2xl font-bold mb-6">Image Library</h1>
        <div
          data-testid="images-loading"
          className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
        >
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[260px] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-10">
        <h1 className="text-2xl font-bold mb-6">Image Library</h1>
        <Alert variant="destructive" data-testid="images-error">
          <AlertDescription>Failed to load images: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-10">
      <h1 className="text-2xl font-bold mb-6">Image Library</h1>

      <ImageUploader onUpload={onUpload} />

      {images.length === 0 && (
        <div data-testid="images-empty" className="mt-8 text-center py-8">
          <p className="text-lg text-muted-foreground">No images yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload your first avatar image above.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.tag} className="mt-8">
          <h2 className="text-base font-semibold capitalize mb-3">{group.tag}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {group.images.map((img) => (
              <ImageCard
                key={img.data.id}
                image={img}
                allTags={allTags}
                onRename={(name) => void onRename(img.data.id, name)}
                onDelete={() => void handleDeleteClick(img)}
                onReplace={(blob, dims, onProgress) =>
                  onReplace(img.data.id, blob, dims, onProgress)
                }
                onTagsChange={(tags) => void onUpdateTags(img.data.id, tags)}
              />
            ))}
          </div>
        </section>
      ))}

      {deletingImage && (
        <DeleteImageDialog
          image={deletingImage}
          referencingRules={referencingRules}
          allImages={images}
          onDeleteImageOnly={() => void handleDeleteConfirm()}
          onDeleteImageAndRules={() => void handleDeleteWithRules()}
          onReassignAndDelete={(newId) => void handleReassign(newId)}
          onCancel={() => setDeletingImage(null)}
        />
      )}
    </div>
  );
}

export function Images() {
  const {
    images,
    loading,
    error,
    uploadImage,
    deleteImage,
    deleteImageAndRules,
    reassignRulesAndDelete,
    renameImage,
    updateTags,
    replaceImage,
    getReferencingRules,
  } = useImages();

  return (
    <ImagesView
      images={images}
      loading={loading}
      error={error}
      onUpload={uploadImage}
      onDelete={deleteImage}
      onDeleteImageAndRules={deleteImageAndRules}
      onReassignAndDelete={reassignRulesAndDelete}
      onRename={renameImage}
      onUpdateTags={updateTags}
      onReplace={replaceImage}
      getReferencingRules={getReferencingRules}
    />
  );
}
