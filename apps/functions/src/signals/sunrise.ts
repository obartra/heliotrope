import SunCalc from 'suncalc';

export function getSunTimes(lat: number, lon: number, date: Date): { sunrise: Date; sunset: Date } {
  const times = SunCalc.getTimes(date, lat, lon);
  return { sunrise: times.sunrise, sunset: times.sunset };
}
