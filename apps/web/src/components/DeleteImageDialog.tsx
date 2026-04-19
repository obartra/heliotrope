import type { Rule } from '@heliotrope/schema';
import { useState } from 'react';
import type { ImageWithUrl } from '../lib/useImages';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface DeleteImageDialogProps {
  image: ImageWithUrl;
  referencingRules: Rule[];
  allImages: ImageWithUrl[];
  onDeleteImageOnly: () => void;
  onDeleteImageAndRules: () => void;
  onReassignAndDelete: (newImageId: string) => void;
  onCancel: () => void;
}

export function DeleteImageDialog({
  image,
  referencingRules,
  allImages,
  onDeleteImageOnly,
  onDeleteImageAndRules,
  onReassignAndDelete,
  onCancel,
}: DeleteImageDialogProps) {
  const [reassignTarget, setReassignTarget] = useState('');
  const otherImages = allImages.filter((img) => img.data.id !== image.data.id);

  const hasRules = referencingRules.length > 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent data-testid="delete-image-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &quot;{image.data.displayName}&quot;?</DialogTitle>
          {!hasRules && (
            <DialogDescription>
              This image is not referenced by any rules. It will be permanently deleted.
            </DialogDescription>
          )}
          {hasRules && (
            <DialogDescription>
              This image is referenced by {referencingRules.length} rule
              {referencingRules.length === 1 ? '' : 's'}:
            </DialogDescription>
          )}
        </DialogHeader>

        {!hasRules && (
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDeleteImageOnly}
              data-testid="confirm-delete-btn"
            >
              Delete
            </Button>
          </DialogFooter>
        )}

        {hasRules && (
          <div className="space-y-4">
            <ul
              className="list-disc pl-5 text-sm text-muted-foreground"
              data-testid="referencing-rules-list"
            >
              {referencingRules.map((rule) => (
                <li key={rule.id}>{rule.name}</li>
              ))}
            </ul>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={onDeleteImageAndRules}
              data-testid="delete-with-rules-btn"
            >
              Delete image and {referencingRules.length} referencing rule
              {referencingRules.length === 1 ? '' : 's'}
            </Button>

            {otherImages.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="reassign-select">Or reassign rules to another image:</Label>
                <div className="flex gap-2">
                  <select
                    id="reassign-select"
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                    data-testid="reassign-image-select"
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select an image...</option>
                    {otherImages.map((img) => (
                      <option key={img.data.id} value={img.data.id}>
                        {img.data.displayName}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!reassignTarget}
                    onClick={() => onReassignAndDelete(reassignTarget)}
                    data-testid="reassign-and-delete-btn"
                  >
                    Reassign and delete
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
