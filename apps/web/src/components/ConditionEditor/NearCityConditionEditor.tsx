import type { NearCityCondition } from '@heliotrope/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NearCityConditionEditorProps {
  value: NearCityCondition;
  onChange: (updated: NearCityCondition) => void;
}

export function NearCityConditionEditor({ value, onChange }: NearCityConditionEditorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Minimum population</Label>
        <Input
          type="number"
          min={0}
          value={value.minPopulation}
          onChange={(e) => onChange({ ...value, minPopulation: parseInt(e.target.value, 10) || 0 })}
        />
      </div>
      <div className="space-y-1">
        <Label>Maximum distance (km)</Label>
        <Input
          type="number"
          min={0}
          step={0.1}
          value={value.maxDistanceKm}
          onChange={(e) => onChange({ ...value, maxDistanceKm: parseFloat(e.target.value) || 1 })}
        />
      </div>
    </div>
  );
}
