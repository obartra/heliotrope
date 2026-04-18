import type { Rule } from '@heliotrope/schema';
import { Timestamp } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getConditionLabel } from '@/lib/conditionUtils';
import type { ImageWithUrl } from '@/lib/useImages';
import { useImages } from '@/lib/useImages';
import { useRules } from '@/lib/useRules';

export interface RulesViewProps {
  rules: Rule[];
  images: ImageWithUrl[];
  loading: boolean;
  error: string | null;
  onAdd: () => void;
  onToggleEnabled: (ruleId: string, enabled: boolean) => void;
  onReorder: (ruleId: string, direction: 'up' | 'down') => void;
  onDelete: (ruleId: string) => void;
}

export function RulesView({
  rules,
  images,
  loading,
  error,
  onAdd,
  onToggleEnabled,
  onReorder,
  onDelete,
}: RulesViewProps) {
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const imageMap = useMemo(() => new Map(images.map((i) => [i.data.id, i])), [images]);

  function getImageThumb(imageId: string) {
    const img = imageMap.get(imageId);
    if (!img) return null;
    return (
      <img
        src={img.downloadUrl}
        alt={img.data.displayName}
        className="w-10 h-10 rounded object-cover"
      />
    );
  }

  function conditionSummary(rule: Rule) {
    if (rule.conditions.length === 0) return 'No conditions';
    const types = rule.conditions.map((c) => getConditionLabel(c.type));
    return `${String(rule.conditions.length)} condition${rule.conditions.length === 1 ? '' : 's'}: ${types.join(', ')}`;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rules</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard">Back</Link>
          </Button>
          <Button onClick={onAdd}>Add rule</Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rules.length === 0 && !error && (
        <p className="text-muted-foreground">No rules yet. Add one to get started.</p>
      )}

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-start gap-3">
              {/* Move buttons */}
              <div className="flex flex-col gap-1 pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-xs"
                  disabled={idx === 0}
                  onClick={() => onReorder(rule.id, 'up')}
                  aria-label="Move up"
                >
                  &#x25B2;
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-xs"
                  disabled={idx === rules.length - 1}
                  onClick={() => onReorder(rule.id, 'down')}
                  aria-label="Move down"
                >
                  &#x25BC;
                </Button>
              </div>

              {/* Image thumbnail */}
              <div className="flex-shrink-0">
                {rule.imageId ? (
                  getImageThumb(rule.imageId)
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    ?
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <Link to={`/rules/${rule.id}`} className="font-medium hover:underline">
                  {rule.name || 'Untitled rule'}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Priority {String(rule.priority)} {conditionSummary(rule)}
                </p>
              </div>

              {/* Toggle + delete */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => onToggleEnabled(rule.id, checked)}
                  aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name || 'rule'}`}
                />
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(rule)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name ?? 'Untitled rule'}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Rules() {
  const { rules, loading, error, createRule, updateRule, deleteRule, reorderRules } = useRules();
  const { images } = useImages();
  const navigate = useNavigate();

  async function handleAdd() {
    const highestPriority = rules.length > 0 && rules[0] ? rules[0].priority : 0;
    const now = Timestamp.now();
    const newRule: Rule = {
      id: crypto.randomUUID(),
      name: '',
      enabled: true,
      priority: highestPriority + 10,
      imageId: '',
      conditions: [],
      createdAt: now,
      updatedAt: now,
    };
    await createRule(newRule);
    navigate(`/rules/${newRule.id}`);
  }

  return (
    <RulesView
      rules={rules}
      images={images}
      loading={loading}
      error={error}
      onAdd={() => void handleAdd()}
      onToggleEnabled={(ruleId, enabled) => void updateRule(ruleId, { enabled })}
      onReorder={(ruleId, direction) => void reorderRules(ruleId, direction)}
      onDelete={(ruleId) => void deleteRule(ruleId)}
    />
  );
}
