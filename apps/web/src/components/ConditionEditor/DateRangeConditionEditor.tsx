import type { DateRangeCondition } from '@heliotrope/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRangeConditionEditorProps {
  value: DateRangeCondition;
  onChange: (updated: DateRangeCondition) => void;
}

export function DateRangeConditionEditor({ value, onChange }: DateRangeConditionEditorProps) {
  const invalid = value.fromISO > value.toISO;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label>From</Label>
          <Input
            type="date"
            value={value.fromISO}
            onChange={(e) => onChange({ ...value, fromISO: e.target.value })}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>To</Label>
          <Input
            type="date"
            value={value.toISO}
            onChange={(e) => onChange({ ...value, toISO: e.target.value })}
          />
        </div>
      </div>
      {invalid && <p className="text-sm text-destructive">From date must not be after To date.</p>}
    </div>
  );
}
