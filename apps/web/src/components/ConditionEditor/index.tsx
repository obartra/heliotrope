import type { Condition } from '@heliotrope/schema';
import { CountryConditionEditor } from './CountryConditionEditor';
import { DateConditionEditor } from './DateConditionEditor';
import { DateRangeConditionEditor } from './DateRangeConditionEditor';
import { DayOfWeekConditionEditor } from './DayOfWeekConditionEditor';
import { GeofenceCircleConditionEditor } from './GeofenceCircleConditionEditor';
import { GeofencePolygonConditionEditor } from './GeofencePolygonConditionEditor';
import { MonthRangeConditionEditor } from './MonthRangeConditionEditor';
import { NearCityConditionEditor } from './NearCityConditionEditor';
import { TimeOfDayConditionEditor } from './TimeOfDayConditionEditor';
import { TimeRangeConditionEditor } from './TimeRangeConditionEditor';
import { WeatherConditionEditor } from './WeatherConditionEditor';

export { CountryConditionEditor } from './CountryConditionEditor';
export { DateConditionEditor } from './DateConditionEditor';
export { DateRangeConditionEditor } from './DateRangeConditionEditor';
export { DayOfWeekConditionEditor } from './DayOfWeekConditionEditor';
export { GeofenceCircleConditionEditor } from './GeofenceCircleConditionEditor';
export { GeofencePolygonConditionEditor } from './GeofencePolygonConditionEditor';
export { MonthRangeConditionEditor } from './MonthRangeConditionEditor';
export { NearCityConditionEditor } from './NearCityConditionEditor';
export { TimeOfDayConditionEditor } from './TimeOfDayConditionEditor';
export { TimeRangeConditionEditor } from './TimeRangeConditionEditor';
export { WeatherConditionEditor } from './WeatherConditionEditor';

interface ConditionEditorDispatchProps {
  value: Condition;
  onChange: (updated: Condition) => void;
}

export function ConditionEditorDispatch({ value, onChange }: ConditionEditorDispatchProps) {
  switch (value.type) {
    case 'date':
      return <DateConditionEditor value={value} onChange={onChange} />;
    case 'dateRange':
      return <DateRangeConditionEditor value={value} onChange={onChange} />;
    case 'monthRange':
      return <MonthRangeConditionEditor value={value} onChange={onChange} />;
    case 'dayOfWeek':
      return <DayOfWeekConditionEditor value={value} onChange={onChange} />;
    case 'timeRange':
      return <TimeRangeConditionEditor value={value} onChange={onChange} />;
    case 'timeOfDay':
      return <TimeOfDayConditionEditor value={value} onChange={onChange} />;
    case 'geofenceCircle':
      return <GeofenceCircleConditionEditor value={value} onChange={onChange} />;
    case 'geofencePolygon':
      return <GeofencePolygonConditionEditor value={value} onChange={onChange} />;
    case 'country':
      return <CountryConditionEditor value={value} onChange={onChange} />;
    case 'weather':
      return <WeatherConditionEditor value={value} onChange={onChange} />;
    case 'nearCity':
      return <NearCityConditionEditor value={value} onChange={onChange} />;
  }
}
