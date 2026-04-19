import { getFirestore } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import type { ResolverSignals } from '../resolver/types.js';
import { fetchGeocoding } from './geocoding.js';
import { getSunTimes } from './sunrise.js';
import { fetchWeather } from './weather.js';

export async function assembleSignals(uid: string, now: Date): Promise<ResolverSignals> {
  const db = getFirestore();
  const locSnap = await db
    .collection('users')
    .doc(uid)
    .collection('locations')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  const defaultSunTimes = getSunTimes(0, 0, now);
  const defaultSignals: ResolverSignals = {
    location: null,
    weather: null,
    sunrise: defaultSunTimes.sunrise,
    sunset: defaultSunTimes.sunset,
    country: null,
    nearbyCities: [],
  };

  if (locSnap.empty) return defaultSignals;

  const locDoc = locSnap.docs[0];
  if (!locDoc) return defaultSignals;

  const locData = locDoc.data() as { lat: number; lon: number; timestamp: Timestamp };
  const locTimestamp = locData.timestamp.toDate();
  const ageMinutes = (now.getTime() - locTimestamp.getTime()) / 60000;

  const location = { lat: locData.lat, lon: locData.lon, ageMinutes };
  const sunTimes = getSunTimes(locData.lat, locData.lon, now);

  const [weather, geocoding] = await Promise.all([
    fetchWeather(locData.lat, locData.lon),
    fetchGeocoding(locData.lat, locData.lon),
  ]);

  return {
    location,
    weather,
    sunrise: sunTimes.sunrise,
    sunset: sunTimes.sunset,
    country: geocoding.country,
    nearbyCities: geocoding.nearbyCities,
  };
}
