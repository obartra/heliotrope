import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearWeatherCache, fetchWeather } from './weather.js';

describe('fetchWeather', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearWeatherCache();
  });

  it('returns parsed weather data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: {
            temperature_2m: 22.5,
            precipitation: 0.3,
            snowfall: 0,
            weather_code: 1,
          },
        }),
    } as Response);

    const result = await fetchWeather(40.71, -74.01);
    expect(result).toEqual({
      temperatureC: 22.5,
      precipitationMmPerHour: 0.3,
      snowfallMmPerHour: 0,
      weatherCode: 1,
    });
  });

  it('returns null on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
    const result = await fetchWeather(40.71, -74.01);
    expect(result).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    const result = await fetchWeather(40.71, -74.01);
    expect(result).toBeNull();
  });
});
