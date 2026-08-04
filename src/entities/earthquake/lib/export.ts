import type { EarthquakeEvent } from '../model';

export interface EarthquakeExportOptions {
  readonly generatedAt?: string;
  readonly source?: string;
  readonly queryDescription?: string;
  readonly protectSpreadsheetFormulas?: boolean;
}

export interface EarthquakeExportMetadata {
  readonly generatedAt: string;
  readonly source: string;
  readonly queryDescription: string | null;
}

export interface EarthquakeGeoJsonFeature {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: {
    readonly type: 'Point';
    readonly coordinates: readonly [number, number, number];
  };
  readonly properties: {
    readonly magnitude: number | null;
    readonly magnitudeType: string | null;
    readonly place: string;
    readonly occurredAt: string;
    readonly updatedAt: string;
    readonly significance: number;
    readonly feltReports: number | null;
    readonly alertLevel: string | null;
    readonly tsunamiFlag: boolean;
    readonly reviewStatus: string;
    readonly sourceNetwork: string;
    readonly detailUrl: string;
    readonly webUrl: string;
  };
}

export interface EarthquakeGeoJsonCollection {
  readonly type: 'FeatureCollection';
  readonly metadata: EarthquakeExportMetadata;
  readonly features: readonly EarthquakeGeoJsonFeature[];
}

function resolveMetadata(options: EarthquakeExportOptions): EarthquakeExportMetadata {
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: options.source ?? 'USGS Earthquake Hazards Program',
    queryDescription: options.queryDescription ?? null,
  };
}

function protectCsvFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCsvField(
  value: string | number | boolean | null,
  protectSpreadsheetFormulas = true,
): string {
  if (value === null) return '';
  const raw = String(value);
  const protectedValue =
    protectSpreadsheetFormulas && typeof value === 'string' ? protectCsvFormula(raw) : raw;
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}

const CSV_HEADERS = [
  'id',
  'magnitude',
  'magnitude_type',
  'place',
  'occurred_at',
  'updated_at',
  'latitude',
  'longitude',
  'depth_km',
  'significance',
  'felt_reports',
  'alert_level',
  'tsunami_flag',
  'review_status',
  'source_network',
  'detail_url',
  'web_url',
  'station_count',
  'minimum_distance',
  'rms',
  'azimuthal_gap',
  'export_generated_at',
  'data_source',
  'query_description',
] as const;

export function exportEarthquakesToCsv(
  events: readonly EarthquakeEvent[],
  options: EarthquakeExportOptions = {},
): string {
  const metadata = resolveMetadata(options);
  const protectFormulas = options.protectSpreadsheetFormulas ?? true;
  const rows = events.map(
    (event) =>
      [
        event.id,
        event.magnitude,
        event.magnitudeType,
        event.place,
        event.occurredAt,
        event.updatedAt,
        event.coordinates.latitude,
        event.coordinates.longitude,
        event.coordinates.depthKm,
        event.significance,
        event.feltReports,
        event.alertLevel,
        event.tsunamiFlag,
        event.reviewStatus,
        event.sourceNetwork,
        event.detailUrl,
        event.webUrl,
        event.quality.stationCount,
        event.quality.minimumDistance,
        event.quality.rms,
        event.quality.azimuthalGap,
        metadata.generatedAt,
        metadata.source,
        metadata.queryDescription,
      ] satisfies readonly (string | number | boolean | null)[],
  );

  return [
    CSV_HEADERS.join(','),
    ...rows.map((row) => row.map((value) => escapeCsvField(value, protectFormulas)).join(',')),
  ].join('\r\n');
}

export function exportEarthquakesToGeoJson(
  events: readonly EarthquakeEvent[],
  options: EarthquakeExportOptions = {},
): EarthquakeGeoJsonCollection {
  return {
    type: 'FeatureCollection',
    metadata: resolveMetadata(options),
    features: events.map((event) => ({
      type: 'Feature',
      id: event.id,
      geometry: {
        type: 'Point',
        coordinates: [
          event.coordinates.longitude,
          event.coordinates.latitude,
          event.coordinates.depthKm,
        ],
      },
      properties: {
        magnitude: event.magnitude,
        magnitudeType: event.magnitudeType,
        place: event.place,
        occurredAt: event.occurredAt,
        updatedAt: event.updatedAt,
        significance: event.significance,
        feltReports: event.feltReports,
        alertLevel: event.alertLevel,
        tsunamiFlag: event.tsunamiFlag,
        reviewStatus: event.reviewStatus,
        sourceNetwork: event.sourceNetwork,
        detailUrl: event.detailUrl,
        webUrl: event.webUrl,
      },
    })),
  };
}

export function exportEarthquakesToNormalizedJson(
  events: readonly EarthquakeEvent[],
  options: EarthquakeExportOptions = {},
): string {
  return JSON.stringify({ metadata: resolveMetadata(options), events }, null, 2);
}

export type EarthquakeExportExtension = 'csv' | 'geojson' | 'json';

export function buildEarthquakeExportFilename(
  extension: EarthquakeExportExtension,
  generatedAt = new Date().toISOString(),
): string {
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  return `sismoscope-earthquakes-${timestamp}.${extension}`;
}
