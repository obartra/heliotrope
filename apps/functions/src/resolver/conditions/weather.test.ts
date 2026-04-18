import { describe, it, expect } from 'vitest';
import type { ResolverSignals } from '../types.js';
import { matchWeather } from './weather.js';

function makeSignals(weather: ResolverSignals['weather']): ResolverSignals {
  return {
    location: null,
    weather,
    sunrise: new Date(),
    sunset: new Date(),
    country: null,
    nearbyCities: [],
  };
}

const sampleWeather = {
  precipitationMmPerHour: 2.5,
  snowfallMmPerHour: 0,
  temperatureC: 25,
  weatherCode: 61,
};

describe('matchWeather', () => {
  it('greater than operator', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '>', value: 20 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('less than operator', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '<', value: 20 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('greater than or equal operator', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '>=', value: 25 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('less than or equal operator', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '<=', value: 25 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('equality operator', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '==', value: 25 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('equality operator does not match', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '==', value: 26 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });

  it('returns no weather data when signal is null', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '>', value: 0 },
      makeSignals(null),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
    expect(result.detail).toBe('no weather data available');
  });

  it('checks precipitationMmPerHour field', () => {
    const result = matchWeather(
      { type: 'weather', field: 'precipitationMmPerHour', op: '>', value: 1 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('checks snowfallMmPerHour field', () => {
    const result = matchWeather(
      { type: 'weather', field: 'snowfallMmPerHour', op: '==', value: 0 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('checks weatherCode field', () => {
    const result = matchWeather(
      { type: 'weather', field: 'weatherCode', op: '>=', value: 60 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(true);
  });

  it('boundary value: strictly greater fails at equality', () => {
    const result = matchWeather(
      { type: 'weather', field: 'temperatureC', op: '>', value: 25 },
      makeSignals(sampleWeather),
      new Date(),
      'UTC',
    );
    expect(result.matched).toBe(false);
  });
});
