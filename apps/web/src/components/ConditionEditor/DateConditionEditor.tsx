import type { DateCondition } from '@heliotrope/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MONTH_NAMES } from '@/lib/conditionUtils';

interface DateConditionEditorProps {
  value: DateCondition;
  onChange: (updated: DateCondition) => void;
}

export function DateConditionEditor({ value, onChange }: DateConditionEditorProps) {
  const [mm, dd] = value.monthDay.split('-');
  const month = mm ?? '01';
  const day = dd ?? '01';

  function setMonthDay(m: string, d: string) {
    onChange({ ...value, monthDay: `${m}-${d}` });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label>Month</Label>
          <Select value={month} onValueChange={(m) => setMonthDay(m, day)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i + 1).padStart(2, '0')}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-20 space-y-1">
          <Label>Day</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={parseInt(day, 10)}
            onChange={(e) =>
              setMonthDay(month, String(parseInt(e.target.value, 10) || 1).padStart(2, '0'))
            }
          />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label>Days before</Label>
          <Input
            type="number"
            min={0}
            value={value.windowDaysBefore ?? 0}
            onChange={(e) =>
              onChange({ ...value, windowDaysBefore: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>Days after</Label>
          <Input
            type="number"
            min={0}
            value={value.windowDaysAfter ?? 0}
            onChange={(e) =>
              onChange({ ...value, windowDaysAfter: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
      </div>
    </div>
  );
}
