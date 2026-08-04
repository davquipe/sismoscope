import type { EarthquakeSearchQuery } from '@/entities/earthquake/model/types';
import { REGION_PRESETS, type RegionPresetId } from '@/entities/region/regions';

export type SearchTimeWindow = 'hour' | 'day' | 'week' | 'month' | 'custom';
export type ExplorerView = 'map' | 'list' | 'split';

export type ExplorerGeographicOverride =
  | {
      readonly type: 'rectangle';
      readonly bounds: {
        readonly minLatitude: number;
        readonly maxLatitude: number;
        readonly minLongitude: number;
        readonly maxLongitude: number;
      };
    }
  | {
      readonly type: 'circle';
      readonly center: { readonly latitude: number; readonly longitude: number };
      readonly radiusKm: number;
    }
  | null;

export interface ExplorerFilters {
  readonly timeWindow: SearchTimeWindow;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly minMagnitude: number | null;
  readonly maxMagnitude: number | null;
  readonly minDepthKm: number | null;
  readonly maxDepthKm: number | null;
  readonly region: RegionPresetId;
  readonly geographicOverride: ExplorerGeographicOverride;
  readonly minFelt: number | null;
  readonly minSignificance: number | null;
  readonly alertLevel: 'all' | 'green' | 'yellow' | 'orange' | 'red';
  readonly reviewStatus: 'all' | 'automatic' | 'reviewed';
  readonly orderBy: 'time' | 'time-asc' | 'magnitude' | 'magnitude-asc';
  readonly page: number;
  readonly pageSize: 25 | 50 | 100;
  readonly view: ExplorerView;
}

export const DEFAULT_EXPLORER_FILTERS: ExplorerFilters = {
  timeWindow: 'day',
  startTime: null,
  endTime: null,
  minMagnitude: null,
  maxMagnitude: null,
  minDepthKm: null,
  maxDepthKm: null,
  region: 'peru',
  geographicOverride: null,
  minFelt: null,
  minSignificance: null,
  alertLevel: 'all',
  reviewStatus: 'all',
  orderBy: 'time',
  page: 1,
  pageSize: 100,
  view: 'split',
};

const timeWindows = new Set<SearchTimeWindow>(['hour', 'day', 'week', 'month', 'custom']);
const regionIds = new Set<RegionPresetId>(Object.keys(REGION_PRESETS) as RegionPresetId[]);
const views = new Set<ExplorerView>(['map', 'list', 'split']);
const orderValues = new Set<ExplorerFilters['orderBy']>([
  'time',
  'time-asc',
  'magnitude',
  'magnitude-asc',
]);

function finiteNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validIso(value: string | null): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function parseExplorerFilters(params: URLSearchParams): ExplorerFilters {
  const time = params.get('time') as SearchTimeWindow | null;
  const region = params.get('region') as RegionPresetId | null;
  const view = params.get('view') as ExplorerView | null;
  const order = params.get('order') as ExplorerFilters['orderBy'] | null;
  const pageSize = positiveInteger(params.get('size'), DEFAULT_EXPLORER_FILTERS.pageSize);
  const alert = params.get('alert');
  const review = params.get('review');
  const minLatitude = finiteNumber(params.get('minLat'));
  const maxLatitude = finiteNumber(params.get('maxLat'));
  const minLongitude = finiteNumber(params.get('minLon'));
  const maxLongitude = finiteNumber(params.get('maxLon'));
  const rectangle =
    minLatitude !== null &&
    maxLatitude !== null &&
    minLongitude !== null &&
    maxLongitude !== null &&
    minLatitude >= -90 &&
    maxLatitude <= 90 &&
    minLongitude >= -180 &&
    maxLongitude <= 180 &&
    minLatitude < maxLatitude &&
    minLongitude < maxLongitude
      ? { minLatitude, maxLatitude, minLongitude, maxLongitude }
      : null;
  const circleLatitude = finiteNumber(params.get('lat'));
  const circleLongitude = finiteNumber(params.get('lon'));
  const radiusKm = finiteNumber(params.get('radius'));
  const circle =
    circleLatitude !== null &&
    circleLongitude !== null &&
    radiusKm !== null &&
    circleLatitude >= -90 &&
    circleLatitude <= 90 &&
    circleLongitude >= -180 &&
    circleLongitude <= 180 &&
    radiusKm > 0 &&
    radiusKm <= 20_001.6
      ? {
          type: 'circle' as const,
          center: { latitude: circleLatitude, longitude: circleLongitude },
          radiusKm,
        }
      : null;
  const geographicOverride: ExplorerGeographicOverride = circle
    ? circle
    : rectangle
      ? { type: 'rectangle', bounds: rectangle }
      : null;

  return {
    timeWindow: time && timeWindows.has(time) ? time : DEFAULT_EXPLORER_FILTERS.timeWindow,
    startTime: validIso(params.get('start')),
    endTime: validIso(params.get('end')),
    minMagnitude: finiteNumber(params.get('minMag')),
    maxMagnitude: finiteNumber(params.get('maxMag')),
    minDepthKm: finiteNumber(params.get('minDepth')),
    maxDepthKm: finiteNumber(params.get('maxDepth')),
    region: region && regionIds.has(region) ? region : DEFAULT_EXPLORER_FILTERS.region,
    geographicOverride,
    minFelt: finiteNumber(params.get('felt')),
    minSignificance: finiteNumber(params.get('sig')),
    alertLevel:
      alert === 'green' || alert === 'yellow' || alert === 'orange' || alert === 'red'
        ? alert
        : 'all',
    reviewStatus: review === 'automatic' || review === 'reviewed' ? review : 'all',
    orderBy: order && orderValues.has(order) ? order : DEFAULT_EXPLORER_FILTERS.orderBy,
    page: positiveInteger(params.get('page'), DEFAULT_EXPLORER_FILTERS.page),
    pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 100,
    view: view && views.has(view) ? view : DEFAULT_EXPLORER_FILTERS.view,
  };
}

export function serializeExplorerFilters(filters: ExplorerFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.timeWindow !== DEFAULT_EXPLORER_FILTERS.timeWindow)
    params.set('time', filters.timeWindow);
  if (filters.startTime) params.set('start', filters.startTime);
  if (filters.endTime) params.set('end', filters.endTime);
  if (filters.minMagnitude !== null) params.set('minMag', String(filters.minMagnitude));
  if (filters.maxMagnitude !== null) params.set('maxMag', String(filters.maxMagnitude));
  if (filters.minDepthKm !== null) params.set('minDepth', String(filters.minDepthKm));
  if (filters.maxDepthKm !== null) params.set('maxDepth', String(filters.maxDepthKm));
  if (filters.region !== DEFAULT_EXPLORER_FILTERS.region) params.set('region', filters.region);
  if (filters.geographicOverride?.type === 'rectangle') {
    params.set('minLat', filters.geographicOverride.bounds.minLatitude.toFixed(4));
    params.set('maxLat', filters.geographicOverride.bounds.maxLatitude.toFixed(4));
    params.set('minLon', filters.geographicOverride.bounds.minLongitude.toFixed(4));
    params.set('maxLon', filters.geographicOverride.bounds.maxLongitude.toFixed(4));
  } else if (filters.geographicOverride?.type === 'circle') {
    params.set('lat', filters.geographicOverride.center.latitude.toFixed(4));
    params.set('lon', filters.geographicOverride.center.longitude.toFixed(4));
    params.set('radius', String(filters.geographicOverride.radiusKm));
  }
  if (filters.minFelt !== null) params.set('felt', String(filters.minFelt));
  if (filters.minSignificance !== null) params.set('sig', String(filters.minSignificance));
  if (filters.alertLevel !== 'all') params.set('alert', filters.alertLevel);
  if (filters.reviewStatus !== 'all') params.set('review', filters.reviewStatus);
  if (filters.orderBy !== DEFAULT_EXPLORER_FILTERS.orderBy) params.set('order', filters.orderBy);
  if (filters.page !== DEFAULT_EXPLORER_FILTERS.page) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_EXPLORER_FILTERS.pageSize)
    params.set('size', String(filters.pageSize));
  if (filters.view !== DEFAULT_EXPLORER_FILTERS.view) params.set('view', filters.view);
  return params;
}

const windowDurationMs: Record<Exclude<SearchTimeWindow, 'custom'>, number> = {
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
  month: 30 * 24 * 60 * 60_000,
};

export function filtersToSearchQuery(
  filters: ExplorerFilters,
  now = Date.now(),
): EarthquakeSearchQuery {
  const preset = REGION_PRESETS[filters.region];
  const startTime =
    filters.timeWindow === 'custom'
      ? filters.startTime
      : new Date(now - windowDurationMs[filters.timeWindow]).toISOString();
  const endTime = filters.timeWindow === 'custom' ? filters.endTime : new Date(now).toISOString();

  return {
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(filters.minMagnitude !== null ? { minMagnitude: filters.minMagnitude } : {}),
    ...(filters.maxMagnitude !== null ? { maxMagnitude: filters.maxMagnitude } : {}),
    ...(filters.minDepthKm !== null ? { minDepthKm: filters.minDepthKm } : {}),
    ...(filters.maxDepthKm !== null ? { maxDepthKm: filters.maxDepthKm } : {}),
    ...(filters.geographicOverride?.type === 'circle'
      ? {
          geographic: {
            type: 'circle' as const,
            center: filters.geographicOverride.center,
            radiusKm: filters.geographicOverride.radiusKm,
          },
        }
      : filters.geographicOverride?.type === 'rectangle'
        ? { geographic: { type: 'rectangle' as const, bounds: filters.geographicOverride.bounds } }
        : preset.bounds
          ? { geographic: { type: 'rectangle' as const, bounds: preset.bounds } }
          : {}),
    ...(filters.minFelt !== null ? { minFelt: filters.minFelt } : {}),
    ...(filters.minSignificance !== null ? { minSignificance: filters.minSignificance } : {}),
    ...(filters.alertLevel !== 'all' ? { alertLevel: filters.alertLevel } : {}),
    ...(filters.reviewStatus !== 'all' ? { reviewStatus: filters.reviewStatus } : {}),
    orderBy: filters.orderBy,
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize + 1,
  };
}
