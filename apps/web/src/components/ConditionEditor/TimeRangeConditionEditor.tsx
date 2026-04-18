import type { TimeRangeCondition } from '@heliotrope/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimeRangeConditionEditorProps {
  value: TimeRangeCondition;
  onChange: (updated: TimeRangeCondition) => void;
}

export function TimeRangeConditionEditor({ value, onChange }: TimeRangeConditionEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label>From</Label>
          <Input
            type="time"
            value={value.fromLocal}
            onChange={(e) => onChange({ ...value, fromLocal: e.target.value })}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>To</Label>
          <Input
            type="time"
            value={value.toLocal}
            onChange={(e) => onChange({ ...value, toLocal: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Midnight-crossing ranges are supported (e.g. 22:00 to 06:00 means overnight).
      </p>
    </div>
  );
}
