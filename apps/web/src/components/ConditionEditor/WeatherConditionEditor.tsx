import type { WeatherCondition } from '@heliotrope/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FIELDS: { value: WeatherCondition['field']; label: string }[] = [
  { value: 'precipitationMmPerHour', label: 'Precipitation (mm/hr)' },
  { value: 'snowfallMmPerHour', label: 'Snowfall (mm/hr)' },
  { value: 'temperatureC', label: 'Temperature (C)' },
  { value: 'weatherCode', label: 'Weather code' },
];

const OPS: WeatherCondition['op'][] = ['>', '<', '>=', '<=', '=='];

interface WeatherConditionEditorProps {
  value: WeatherCondition;
  onChange: (updated: WeatherCondition) => void;
}

export function WeatherConditionEditor({ value, onChange }: WeatherConditionEditorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Field</Label>
        <Select
          value={value.field}
          onValueChange={(v) => onChange({ ...value, field: v as WeatherCondition['field'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-3">
        <div className="w-24 space-y-1">
          <Label>Operator</Label>
          <Select
            value={value.op}
            onValueChange={(v) => onChange({ ...value, op: v as WeatherCondition['op'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label>Value</Label>
          <Input
            type="number"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}
