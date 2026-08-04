import type { EarthquakeEvent, GeographicPoint } from '../model';

const EARTH_MEAN_RADIUS_KM = 6_371.0088;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function validatePoint(point: GeographicPoint): void {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new RangeError('La latitud debe estar entre -90 y 90.');
  }
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new RangeError('La longitud debe estar entre -180 y 180.');
  }
}

/** Great-circle surface distance; event depth is deliberately not included. */
export function haversineDistanceKm(from: GeographicPoint, to: GeographicPoint): number {
  validatePoint(from);
  validatePoint(to);

  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const clampedHaversine = Math.min(1, Math.max(0, haversine));
  const centralAngle = 2 * Math.atan2(Math.sqrt(clampedHaversine), Math.sqrt(1 - clampedHaversine));

  return EARTH_MEAN_RADIUS_KM * centralAngle;
}

export function distanceBetweenEarthquakesKm(
  first: EarthquakeEvent,
  second: EarthquakeEvent,
): number {
  return haversineDistanceKm(first.coordinates, second.coordinates);
}
