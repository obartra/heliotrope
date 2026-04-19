interface GeocodingResult {
  country: string | null;
  nearbyCities: { name: string; population: number; distanceKm: number }[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: GeocodingResult; expiresAt: number }>();

export function clearGeocodingCache(): void {
  cache.clear();
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchGeocoding(lat: number, lon: number): Promise<GeocodingResult> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const roundedLat = parseFloat(lat.toFixed(1));
  const roundedLon = parseFloat(lon.toFixed(1));
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${String(roundedLat)}&longitude=${String(roundedLon)}&count=10&language=en&format=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const fallback: GeocodingResult = { country: null, nearbyCities: [] };
      return fallback;
    }

    const json = (await res.json()) as {
      results?: {
        name?: string;
        country_code?: string;
        population?: number;
        latitude?: number;
        longitude?: number;
      }[];
    };

    const results = json.results ?? [];
    const country = results[0]?.country_code ?? null;

    const nearbyCities = results
      .filter(
        (r) => r.name && r.population && r.latitude !== undefined && r.longitude !== undefined,
      )
      .map((r) => ({
        name: r.name!,
        population: r.population!,
        distanceKm: parseFloat(haversineKm(lat, lon, r.latitude!, r.longitude!).toFixed(2)),
      }));

    const data: GeocodingResult = { country, nearbyCities };
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return { country: null, nearbyCities: [] };
  }
}
