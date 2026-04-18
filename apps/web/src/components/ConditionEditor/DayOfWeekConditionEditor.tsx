import type { DayOfWeekCondition } from '@heliotrope/schema';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DAY_NAMES } from '@/lib/conditionUtils';

const DAYS = DAY_NAMES.map((label, i) => ({ value: i + 1, label }));

interface DayOfWeekConditionEditorProps {
  value: DayOfWeekCondition;
  onChange: (updated: DayOfWeekCondition) => void;
}

export function DayOfWeekConditionEditor({ value, onChange }: DayOfWeekConditionEditorProps) {
  function toggle(day: number) {
    const has = value.days.includes(day);
    const next = has
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b);
    // @ts-expect-error next may be empty, validated before save
    onChange({ ...value, days: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        {DAYS.map((d) => (
          <div key={d.value} className="flex items-center gap-1.5">
            <Checkbox
              id={`dow-${String(d.value)}`}
              checked={value.days.includes(d.value)}
              onCheckedChange={() => toggle(d.value)}
            />
            <Label htmlFor={`dow-${String(d.value)}`} className="text-sm cursor-pointer">
              {d.label}
            </Label>
          </div>
        ))}
      </div>
      {value.days.length === 0 && (
        <p className="text-sm text-destructive">Select at least one day.</p>
      )}
    </div>
  );
}
