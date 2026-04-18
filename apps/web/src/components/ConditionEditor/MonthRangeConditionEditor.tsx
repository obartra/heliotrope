import type { MonthRangeCondition } from '@heliotrope/schema';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MONTH_NAMES } from '@/lib/conditionUtils';

interface MonthRangeConditionEditorProps {
  value: MonthRangeCondition;
  onChange: (updated: MonthRangeCondition) => void;
}

export function MonthRangeConditionEditor({ value, onChange }: MonthRangeConditionEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label>From month</Label>
          <Select
            value={String(value.fromMonth)}
            onValueChange={(v) => onChange({ ...value, fromMonth: parseInt(v, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label>To month</Label>
          <Select
            value={String(value.toMonth)}
            onValueChange={(v) => onChange({ ...value, toMonth: parseInt(v, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Wrapping ranges are supported (e.g. November to February matches Nov, Dec, Jan, Feb).
      </p>
    </div>
  );
}
