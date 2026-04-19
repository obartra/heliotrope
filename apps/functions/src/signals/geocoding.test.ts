import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearGeocodingCache, fetchGeocoding } from './geocoding.js';

describe('fetchGeocoding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearGeocodingCache();
  });

  it('returns country and nearby cities on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              name: 'New York',
              country_code: 'US',
              population: 8336817,
              latitude: 40.7128,
              longitude: -74.006,
            },
          ],
        }),
    } as Response);

    const result = await fetchGeocoding(40.71, -74.01);
    expect(result.country).toBe('US');
    expect(result.nearbyCities).toHaveLength(1);
    expect(result.nearbyCities[0]?.name).toBe('New York');
    expect(result.nearbyCities[0]?.population).toBe(8336817);
    expect(result.nearbyCities[0]?.distanceKm).toBeGreaterThanOrEqual(0);
  });

  it('returns empty result on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
    const result = await fetchGeocoding(40.71, -74.01);
    expect(result.country).toBeNull();
    expect(result.nearbyCities).toEqual([]);
  });

  it('returns empty result on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    const result = await fetchGeocoding(40.71, -74.01);
    expect(result.country).toBeNull();
    expect(result.nearbyCities).toEqual([]);
  });
});
