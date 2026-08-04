import type {
  EarthquakeSearchQuery,
  GeographicBounds,
  GeographicPoint,
} from '../../../entities/earthquake/model';
import { QueryTooLargeError, ValidationError } from '../../errors';

import { DEFAULT_SEARCH_PAGE_SIZE, MAX_USGS_EVENTS, USGS_ENDPOINTS } from './config';

const MAX_RADIUS_KM = 20_001.6;
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/i;

function validateFiniteNumber(name: string, value: number | undefined): void {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new ValidationError(`${name} debe ser un número finito.`);
  }
}

function validateUtcDate(name: string, value: string | undefined): void {
  if (value === undefined) return;
  if (!UTC_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${name} debe ser una fecha ISO en UTC.`);
  }
}

function validatePoint(point: GeographicPoint): void {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new ValidationError('La latitud debe estar entre -90 y 90.');
  }
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new ValidationError('La longitud debe estar entre -180 y 180.');
  }
}

function validateBounds(bounds: GeographicBounds): void {
  validatePoint({ latitude: bounds.minLatitude, longitude: bounds.minLongitude });
  validatePoint({ latitude: bounds.maxLatitude, longitude: bounds.maxLongitude });
  if (bounds.minLatitude > bounds.maxLatitude) {
    throw new ValidationError('La latitud mínima no puede superar la máxima.');
  }
  if (bounds.minLongitude > bounds.maxLongitude) {
    throw new ValidationError('La longitud mínima no puede superar la máxima.');
  }
}

export function validateEarthquakeSearchQuery(query: EarthquakeSearchQuery): void {
  validateUtcDate('startTime', query.startTime);
  validateUtcDate('endTime', query.endTime);
  validateFiniteNumber('minMagnitude', query.minMagnitude);
  validateFiniteNumber('maxMagnitude', query.maxMagnitude);
  validateFiniteNumber('minDepthKm', query.minDepthKm);
  validateFiniteNumber('maxDepthKm', query.maxDepthKm);

  if (
    query.startTime !== undefined &&
    query.endTime !== undefined &&
    Date.parse(query.startTime) > Date.parse(query.endTime)
  ) {
    throw new ValidationError('La fecha inicial no puede ser posterior a la final.');
  }
  if (
    query.minMagnitude !== undefined &&
    query.maxMagnitude !== undefined &&
    query.minMagnitude > query.maxMagnitude
  ) {
    throw new ValidationError('La magnitud mínima no puede superar la máxima.');
  }
  if (
    query.minDepthKm !== undefined &&
    query.maxDepthKm !== undefined &&
    query.minDepthKm > query.maxDepthKm
  ) {
    throw new ValidationError('La profundidad mínima no puede superar la máxima.');
  }

  if (query.geographic?.type === 'rectangle') {
    validateBounds(query.geographic.bounds);
  } else if (query.geographic?.type === 'circle') {
    validatePoint(query.geographic.center);
    if (
      !Number.isFinite(query.geographic.radiusKm) ||
      query.geographic.radiusKm <= 0 ||
      query.geographic.radiusKm > MAX_RADIUS_KM
    ) {
      throw new ValidationError(`El radio debe ser mayor que 0 y no superar ${MAX_RADIUS_KM} km.`);
    }
  }

  if (query.minFelt !== undefined && (!Number.isInteger(query.minFelt) || query.minFelt < 0)) {
    throw new ValidationError('minFelt debe ser un entero no negativo.');
  }
  if (
    query.minSignificance !== undefined &&
    (!Number.isInteger(query.minSignificance) || query.minSignificance < 0)
  ) {
    throw new ValidationError('minSignificance debe ser un entero no negativo.');
  }
  if (
    query.limit !== undefined &&
    (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_USGS_EVENTS)
  ) {
    throw new ValidationError(`limit debe ser un entero entre 1 y ${MAX_USGS_EVENTS}.`);
  }
  if (query.offset !== undefined && (!Number.isInteger(query.offset) || query.offset < 1)) {
    throw new ValidationError('offset debe ser un entero mayor o igual que 1.');
  }
}

function setNumberParameter(
  parameters: URLSearchParams,
  name: string,
  value: number | undefined,
): void {
  if (value !== undefined) parameters.set(name, String(value));
}

function appendGeographicParameters(
  parameters: URLSearchParams,
  query: EarthquakeSearchQuery,
): void {
  if (query.geographic?.type === 'rectangle') {
    const { bounds } = query.geographic;
    setNumberParameter(parameters, 'minlatitude', bounds.minLatitude);
    setNumberParameter(parameters, 'maxlatitude', bounds.maxLatitude);
    setNumberParameter(parameters, 'minlongitude', bounds.minLongitude);
    setNumberParameter(parameters, 'maxlongitude', bounds.maxLongitude);
  } else if (query.geographic?.type === 'circle') {
    const { center, radiusKm } = query.geographic;
    setNumberParameter(parameters, 'latitude', center.latitude);
    setNumberParameter(parameters, 'longitude', center.longitude);
    setNumberParameter(parameters, 'maxradiuskm', radiusKm);
  }
}

export interface SerializeUsgsQueryOptions {
  readonly includePagination?: boolean;
}

export function serializeUsgsQuery(
  query: EarthquakeSearchQuery,
  options: SerializeUsgsQueryOptions = {},
): URLSearchParams {
  validateEarthquakeSearchQuery(query);

  const parameters = new URLSearchParams();
  parameters.set('format', 'geojson');
  parameters.set('eventtype', 'earthquake');
  parameters.set('jsonerror', 'true');
  if (query.startTime !== undefined) parameters.set('starttime', query.startTime);
  if (query.endTime !== undefined) parameters.set('endtime', query.endTime);
  setNumberParameter(parameters, 'minmagnitude', query.minMagnitude);
  setNumberParameter(parameters, 'maxmagnitude', query.maxMagnitude);
  setNumberParameter(parameters, 'mindepth', query.minDepthKm);
  setNumberParameter(parameters, 'maxdepth', query.maxDepthKm);
  appendGeographicParameters(parameters, query);
  setNumberParameter(parameters, 'minfelt', query.minFelt);
  setNumberParameter(parameters, 'minsig', query.minSignificance);
  if (query.alertLevel !== undefined) parameters.set('alertlevel', query.alertLevel);
  if (query.reviewStatus !== undefined) parameters.set('reviewstatus', query.reviewStatus);

  if (options.includePagination === true) {
    if (query.orderBy !== undefined) parameters.set('orderby', query.orderBy);
    parameters.set('limit', String(query.limit ?? DEFAULT_SEARCH_PAGE_SIZE));
    parameters.set('offset', String(query.offset ?? 1));
  }

  return parameters;
}

function buildUrl(endpoint: string, parameters: URLSearchParams): string {
  const url = new URL(endpoint);
  url.search = parameters.toString();
  return url.toString();
}

export function buildUsgsCountUrl(query: EarthquakeSearchQuery): string {
  return buildUrl(USGS_ENDPOINTS.count, serializeUsgsQuery(query));
}

export function buildUsgsSearchUrl(query: EarthquakeSearchQuery): string {
  return buildUrl(USGS_ENDPOINTS.search, serializeUsgsQuery(query, { includePagination: true }));
}

export function assertCountWithinLimit(count: number, maximumAllowed = MAX_USGS_EVENTS): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new ValidationError('El conteo de eventos debe ser un entero no negativo.');
  }
  if (!Number.isInteger(maximumAllowed) || maximumAllowed < 1) {
    throw new ValidationError('El máximo de eventos debe ser un entero positivo.');
  }
  if (count > maximumAllowed) {
    throw new QueryTooLargeError(count, maximumAllowed);
  }
}
