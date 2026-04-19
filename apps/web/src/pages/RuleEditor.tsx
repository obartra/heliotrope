import type { Condition, Rule } from '@heliotrope/schema';
import { useCallback, useEffect, useReducer } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConditionEditorDispatch } from '@/components/ConditionEditor';
import { ImagePicker } from '@/components/ImagePicker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  createDefaultCondition,
  getConditionLabel,
  getConditionSummary,
} from '@/lib/conditionUtils';
import type { ImageWithUrl } from '@/lib/useImages';
import { useImages } from '@/lib/useImages';
import { useRules } from '@/lib/useRules';

const CONDITION_TYPES: Condition['type'][] = [
  'date',
  'dateRange',
  'monthRange',
  'dayOfWeek',
  'timeRange',
  'timeOfDay',
  'geofenceCircle',
  'geofencePolygon',
  'country',
  'weather',
  'nearCity',
];

// ── Reducer ──────────────────────────────────────────────

interface EditorState {
  name: string;
  enabled: boolean;
  priority: number;
  imageId: string;
  conditions: Condition[];
  expandedIdx: number | null;
  saving: boolean;
  errors: string[];
}

type EditorAction =
  | { type: 'init'; rule: Rule }
  | { type: 'setName'; name: string }
  | { type: 'setEnabled'; enabled: boolean }
  | { type: 'setPriority'; priority: number }
  | { type: 'setImage'; imageId: string }
  | { type: 'addCondition'; condition: Condition }
  | { type: 'updateCondition'; idx: number; condition: Condition }
  | { type: 'removeCondition'; idx: number }
  | { type: 'toggleExpand'; idx: number }
  | { type: 'setSaving'; saving: boolean }
  | { type: 'setErrors'; errors: string[] };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'init':
      return {
        name: action.rule.name,
        enabled: action.rule.enabled,
        priority: action.rule.priority,
        imageId: action.rule.imageId,
        conditions: action.rule.conditions,
        expandedIdx: null,
        saving: false,
        errors: [],
      };
    case 'setName':
      return { ...state, name: action.name };
    case 'setEnabled':
      return { ...state, enabled: action.enabled };
    case 'setPriority':
      return { ...state, priority: action.priority };
    case 'setImage':
      return { ...state, imageId: action.imageId };
    case 'addCondition':
      return {
        ...state,
        conditions: [...state.conditions, action.condition],
        expandedIdx: state.conditions.length,
      };
    case 'updateCondition':
      return {
        ...state,
        conditions: state.conditions.map((c, i) => (i === action.idx ? action.condition : c)),
      };
    case 'removeCondition':
      return {
        ...state,
        conditions: state.conditions.filter((_, i) => i !== action.idx),
        expandedIdx: null,
      };
    case 'toggleExpand':
      return { ...state, expandedIdx: state.expandedIdx === action.idx ? null : action.idx };
    case 'setSaving':
      return { ...state, saving: action.saving };
    case 'setErrors':
      return { ...state, errors: action.errors };
  }
}

const INITIAL_STATE: EditorState = {
  name: '',
  enabled: true,
  priority: 10,
  imageId: '',
  conditions: [],
  expandedIdx: null,
  saving: false,
  errors: [],
};

// ── View component (for Storybook) ──────────────────────

export interface RuleEditorViewProps {
  rule: Rule | null;
  images: ImageWithUrl[];
  loading: boolean;
  onSave: (updates: Partial<Rule>) => Promise<void>;
}

export function RuleEditorView({ rule, images, loading, onSave }: RuleEditorViewProps) {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);

  useEffect(() => {
    if (rule) {
      dispatch({ type: 'init', rule });
    }
  }, [rule]);

  const validate = useCallback((): string[] => {
    const errs: string[] = [];
    if (!state.name.trim()) errs.push('Name is required.');
    if (!state.imageId) errs.push('An image must be selected.');
    return errs;
  }, [state.name, state.imageId]);

  async function handleSave() {
    const errs = validate();
    if (errs.length > 0) {
      dispatch({ type: 'setErrors', errors: errs });
      return;
    }
    dispatch({ type: 'setSaving', saving: true });
    dispatch({ type: 'setErrors', errors: [] });
    try {
      await onSave({
        name: state.name,
        enabled: state.enabled,
        priority: state.priority,
        imageId: state.imageId,
        conditions: state.conditions,
      });
    } catch (err) {
      dispatch({ type: 'setErrors', errors: [(err as Error).message] });
      dispatch({ type: 'setSaving', saving: false });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <Alert variant="destructive">
          <AlertDescription>Rule not found.</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/rules">Back to rules</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit rule</h1>
        <Button variant="outline" asChild>
          <Link to="/rules">Cancel</Link>
        </Button>
      </div>

      {state.errors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {state.errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="rule-name">Name</Label>
          <Input
            id="rule-name"
            value={state.name}
            onChange={(e) => dispatch({ type: 'setName', name: e.target.value })}
            placeholder="Rule name"
          />
        </div>

        {/* Enabled */}
        <div className="flex items-center gap-3">
          <Switch
            id="rule-enabled"
            checked={state.enabled}
            onCheckedChange={(checked) => dispatch({ type: 'setEnabled', enabled: checked })}
          />
          <Label htmlFor="rule-enabled" className="cursor-pointer">
            Enabled
          </Label>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <Label htmlFor="rule-priority">Priority</Label>
          <Input
            id="rule-priority"
            type="number"
            step={10}
            value={state.priority}
            onChange={(e) =>
              dispatch({ type: 'setPriority', priority: parseInt(e.target.value, 10) || 0 })
            }
          />
          <p className="text-xs text-muted-foreground">
            Higher priority rules are evaluated first.
          </p>
        </div>

        <Separator />

        {/* Image picker */}
        <div className="space-y-2">
          <Label>Image</Label>
          <ImagePicker
            images={images}
            selectedImageId={state.imageId || null}
            onSelect={(imageId) => dispatch({ type: 'setImage', imageId })}
          />
        </div>

        <Separator />

        {/* Conditions */}
        <div className="space-y-3">
          <Label>Conditions</Label>
          {state.conditions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No conditions. This rule will always match.
            </p>
          )}
          {state.conditions.map((condition, idx) => (
            <Card key={idx} className="p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-sm font-medium hover:underline text-left"
                  onClick={() => dispatch({ type: 'toggleExpand', idx })}
                >
                  {getConditionLabel(condition.type)}: {getConditionSummary(condition)}
                </button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: 'toggleExpand', idx })}
                  >
                    {state.expandedIdx === idx ? 'Collapse' : 'Edit'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => dispatch({ type: 'removeCondition', idx })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              {state.expandedIdx === idx && (
                <div className="mt-3 pt-3 border-t">
                  <ConditionEditorDispatch
                    value={condition}
                    onChange={(updated) =>
                      dispatch({ type: 'updateCondition', idx, condition: updated })
                    }
                  />
                </div>
              )}
            </Card>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Add condition
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {CONDITION_TYPES.map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() =>
                    dispatch({ type: 'addCondition', condition: createDefaultCondition(type) })
                  }
                >
                  {getConditionLabel(type)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        {/* Test button (disabled placeholder) */}
        <Button variant="outline" disabled>
          Test (requires signals)
        </Button>

        {/* Save */}
        <div className="flex gap-3">
          <Button onClick={() => void handleSave()} disabled={state.saving}>
            {state.saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/rules">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Connected component ──────────────────────────────────

export function RuleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { rules, loading, updateRule } = useRules();
  const { images } = useImages();

  const rule = rules.find((r) => r.id === id) ?? null;

  async function handleSave(updates: Partial<Rule>) {
    await updateRule(id!, updates);
    navigate('/rules');
  }

  return <RuleEditorView rule={rule} images={images} loading={loading} onSave={handleSave} />;
}
