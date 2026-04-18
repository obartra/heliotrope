import type { WeatherCondition } from '@heliotrope/schema';
import type { ConditionMatcher } from '../types.js';

function compare(actual: number, op: WeatherCondition['op'], value: number): boolean {
  switch (op) {
    case '>':
      return actual > value;
    case '<':
      return actual < value;
    case '>=':
      return actual >= value;
    case '<=':
      return actual <= value;
    case '==':
      return actual === value;
  }
}

export const matchWeather: ConditionMatcher<WeatherCondition> = (condition, signals) => {
  if (signals.weather === null) {
    return { matched: false, detail: 'no weather data available' };
  }

  const actual = signals.weather[condition.field];
  const matched = compare(actual, condition.op, condition.value);

  return {
    matched,
    detail: `${condition.field} ${actual} ${condition.op} ${condition.value} is ${matched}`,
  };
};
