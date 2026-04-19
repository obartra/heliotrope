import type { WeatherData } from '@heliotrope/schema';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { data: WeatherData; expiresAt: number }>();

export function clearWeatherCache(): void {
  cache.clear();
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const roundedLat = parseFloat(lat.toFixed(2));
  const roundedLon = parseFloat(lon.toFixed(2));
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${String(roundedLat)}&longitude=${String(roundedLon)}&current=temperature_2m,precipitation,snowfall,weather_code`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        precipitation?: number;
        snowfall?: number;
        weather_code?: number;
      };
    };

    const current = json.current;
    if (!current) return null;

    const data: WeatherData = {
      temperatureC: current.temperature_2m ?? 0,
      precipitationMmPerHour: current.precipitation ?? 0,
      snowfallMmPerHour: current.snowfall ?? 0,
      weatherCode: current.weather_code ?? 0,
    };

    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return null;
  }
}
