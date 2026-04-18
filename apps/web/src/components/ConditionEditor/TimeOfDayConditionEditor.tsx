import type { TimeOfDayCondition } from '@heliotrope/schema';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface TimeOfDayConditionEditorProps {
  value: TimeOfDayCondition;
  onChange: (updated: TimeOfDayCondition) => void;
}

export function TimeOfDayConditionEditor({ value, onChange }: TimeOfDayConditionEditorProps) {
  return (
    <RadioGroup
      value={value.value}
      onValueChange={(v) => onChange({ ...value, value: v as 'day' | 'night' })}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value="day" id="tod-day" />
        <Label htmlFor="tod-day" className="cursor-pointer">
          Day (sunrise to sunset)
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="night" id="tod-night" />
        <Label htmlFor="tod-night" className="cursor-pointer">
          Night (sunset to sunrise)
        </Label>
      </div>
    </RadioGroup>
  );
}
