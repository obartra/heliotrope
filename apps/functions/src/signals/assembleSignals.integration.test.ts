import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearUserData, emulatorRunning } from '../test-utils.js';
import { assembleSignals } from './assembleSignals.js';
import { clearGeocodingCache } from './geocoding.js';
import { clearWeatherCache } from './weather.js';

const UID = 'test-signals';

const WEATHER_RESPONSE = {
  current: {
    temperature_2m: 22.5,
    precipitation: 0.3,
    snowfall: 0,
    weather_code: 1,
  },
};

const GEOCODING_RESPONSE = {
  results: [
    {
      name: 'New York',
      latitude: 40.71,
      longitude: -74.01,
      population: 8336817,
      country_code: 'US',
    },
  ],
};

function mockFetchSuccess() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(WEATHER_RESPONSE),
      } as Response);
    }
    if (url.includes('geocoding-api.open-meteo.com')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(GEOCODING_RESPONSE),
      } as Response);
    }
    return Promise.resolve({ ok: false } as Response);
  });
}

async function seedLocation(ageMinutes: number) {
  const db = getFirestore();
  const now = new Date();
  const locTs = Timestamp.fromDate(new Date(now.getTime() - ageMinutes * 60_000));
  await db
    .collection(`users/${UID}/locations`)
    .doc(locTs.toMillis().toString())
    .set({ lat: 40.71, lon: -74.01, timestamp: locTs, source: 'ios-shortcut', accuracy: null });
  return now;
}

describe.skipIf(!emulatorRunning)('assembleSignals (emulator)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    clearWeatherCache();
    clearGeocodingCache();
    await clearUserData(UID);
  });

  it('returns full signals when location exists and APIs succeed', async () => {
    const now = await seedLocation(5);
    mockFetchSuccess();

    const signals = await assembleSignals(UID, now);

    expect(signals.location).toEqual(expect.objectContaining({ lat: 40.71, lon: -74.01 }));
    expect(signals.location?.ageMinutes).toBeCloseTo(5, 0);
    expect(signals.weather).toEqual({
      temperatureC: 22.5,
      precipitationMmPerHour: 0.3,
      snowfallMmPerHour: 0,
      weatherCode: 1,
    });
    expect(signals.country).toBe('US');
    expect(signals.nearbyCities).toHaveLength(1);
    expect(signals.nearbyCities[0]?.name).toBe('New York');
    expect(signals.sunrise).toBeInstanceOf(Date);
    expect(signals.sunset).toBeInstanceOf(Date);
  });

  it('returns default signals when no location docs exist', async () => {
    const now = new Date();
    const signals = await assembleSignals(UID, now);

    expect(signals.location).toBeNull();
    expect(signals.weather).toBeNull();
    expect(signals.country).toBeNull();
    expect(signals.nearbyCities).toEqual([]);
    expect(signals.sunrise).toBeInstanceOf(Date);
    expect(signals.sunset).toBeInstanceOf(Date);
  });

  it('returns null weather when weather API fails', async () => {
    const now = await seedLocation(5);

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('api.open-meteo.com/v1/forecast')) {
        return Promise.reject(new Error('weather API down'));
      }
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(GEOCODING_RESPONSE),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const signals = await assembleSignals(UID, now);

    expect(signals.weather).toBeNull();
    expect(signals.location).not.toBeNull();
    expect(signals.country).toBe('US');
  });

  it('returns null geocoding when geocoding API fails', async () => {
    const now = await seedLocation(5);

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('api.open-meteo.com/v1/forecast')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(WEATHER_RESPONSE),
        } as Response);
      }
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.reject(new Error('geocoding API down'));
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const signals = await assembleSignals(UID, now);

    expect(signals.country).toBeNull();
    expect(signals.nearbyCities).toEqual([]);
    expect(signals.weather).not.toBeNull();
    expect(signals.location).not.toBeNull();
  });

  it('calculates location age correctly', async () => {
    const now = await seedLocation(30);
    mockFetchSuccess();

    const signals = await assembleSignals(UID, now);

    expect(signals.location?.ageMinutes).toBeCloseTo(30, 0);
  });
});
