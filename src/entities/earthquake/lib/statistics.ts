import type { EarthquakeEvent } from '../model';

export interface DescriptiveStatistics {
  readonly count: number;
  readonly missingCount: number;
  readonly mean: number | null;
  readonly median: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
  /** Population standard deviation (the loaded dataset is treated as the population). */
  readonly standardDeviation: number | null;
  readonly percentiles: {
    readonly p25: number | null;
    readonly p50: number | null;
    readonly p75: number | null;
    readonly p90: number | null;
    readonly p95: number | null;
  };
}

export interface NumericBucket<BucketId extends string> {
  readonly id: BucketId;
  readonly minimumInclusive: number | null;
  readonly maximumExclusive: number | null;
  readonly count: number;
}

export type MagnitudeBucketId = 'below-1' | '1-to-2.5' | '2.5-to-4' | '4-to-6' | '6-plus';

export type DepthBucketId = 'negative' | 'shallow' | 'intermediate' | 'deep';

export interface BucketDistribution<BucketId extends string> {
  readonly buckets: readonly NumericBucket<BucketId>[];
  readonly missingCount: number;
}

export interface EarthquakeStatistics {
  readonly total: number;
  readonly magnitudes: DescriptiveStatistics;
  readonly depthsKm: DescriptiveStatistics;
  readonly maximumMagnitude: number | null;
  readonly averageDepthKm: number | null;
  readonly medianDepthKm: number | null;
  readonly reviewedPercentage: number | null;
  readonly withFeltReportsPercentage: number | null;
  readonly significantCount: number;
  readonly withAlertCount: number;
}

export type TimeGranularity = 'hour' | 'day' | 'week';

export interface TimeBucket {
  readonly startAt: string;
  readonly count: number;
}

function finiteValues(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  );
}

export function percentile(values: readonly number[], requestedPercentile: number): number | null {
  if (
    !Number.isFinite(requestedPercentile) ||
    requestedPercentile < 0 ||
    requestedPercentile > 100
  ) {
    throw new RangeError('El percentil debe estar entre 0 y 100.');
  }

  const sorted = values
    .filter(Number.isFinite)
    .slice()
    .sort((first, second) => first - second);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;

  // Linear interpolation between closest ranks (the R-7/Excel inclusive convention).
  const position = (requestedPercentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lower === undefined || upper === undefined) return null;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

export function calculateDescriptiveStatistics(
  values: readonly (number | null | undefined)[],
): DescriptiveStatistics {
  const valid = finiteValues(values);
  if (valid.length === 0) {
    return {
      count: 0,
      missingCount: values.length,
      mean: null,
      median: null,
      minimum: null,
      maximum: null,
      standardDeviation: null,
      percentiles: { p25: null, p50: null, p75: null, p90: null, p95: null },
    };
  }

  const sum = valid.reduce((total, value) => total + value, 0);
  const mean = sum / valid.length;
  const variance = valid.reduce((total, value) => total + (value - mean) ** 2, 0) / valid.length;

  return {
    count: valid.length,
    missingCount: values.length - valid.length,
    mean,
    median: percentile(valid, 50),
    minimum: valid.reduce((minimum, value) => Math.min(minimum, value), valid[0] ?? 0),
    maximum: valid.reduce((maximum, value) => Math.max(maximum, value), valid[0] ?? 0),
    standardDeviation: Math.sqrt(variance),
    percentiles: {
      p25: percentile(valid, 25),
      p50: percentile(valid, 50),
      p75: percentile(valid, 75),
      p90: percentile(valid, 90),
      p95: percentile(valid, 95),
    },
  };
}

function countInRange(
  values: readonly number[],
  minimumInclusive: number | null,
  maximumExclusive: number | null,
): number {
  return values.filter(
    (value) =>
      (minimumInclusive === null || value >= minimumInclusive) &&
      (maximumExclusive === null || value < maximumExclusive),
  ).length;
}

export function createMagnitudeBuckets(
  values: readonly (number | null | undefined)[],
): BucketDistribution<MagnitudeBucketId> {
  const valid = finiteValues(values);
  const definitions: readonly Omit<NumericBucket<MagnitudeBucketId>, 'count'>[] = [
    { id: 'below-1', minimumInclusive: null, maximumExclusive: 1 },
    { id: '1-to-2.5', minimumInclusive: 1, maximumExclusive: 2.5 },
    { id: '2.5-to-4', minimumInclusive: 2.5, maximumExclusive: 4 },
    { id: '4-to-6', minimumInclusive: 4, maximumExclusive: 6 },
    { id: '6-plus', minimumInclusive: 6, maximumExclusive: null },
  ];

  return {
    buckets: definitions.map((definition) => ({
      ...definition,
      count: countInRange(valid, definition.minimumInclusive, definition.maximumExclusive),
    })),
    missingCount: values.length - valid.length,
  };
}

export function createDepthBuckets(
  values: readonly (number | null | undefined)[],
): BucketDistribution<DepthBucketId> {
  const valid = finiteValues(values);
  const definitions: readonly Omit<NumericBucket<DepthBucketId>, 'count'>[] = [
    { id: 'negative', minimumInclusive: null, maximumExclusive: 0 },
    { id: 'shallow', minimumInclusive: 0, maximumExclusive: 70 },
    { id: 'intermediate', minimumInclusive: 70, maximumExclusive: 300 },
    { id: 'deep', minimumInclusive: 300, maximumExclusive: null },
  ];

  return {
    buckets: definitions.map((definition) => ({
      ...definition,
      count: countInRange(valid, definition.minimumInclusive, definition.maximumExclusive),
    })),
    missingCount: values.length - valid.length,
  };
}

function percentage(part: number, total: number): number | null {
  return total === 0 ? null : (part / total) * 100;
}

export function calculateEarthquakeStatistics(
  events: readonly EarthquakeEvent[],
): EarthquakeStatistics {
  const magnitudes = calculateDescriptiveStatistics(events.map((event) => event.magnitude));
  const depthsKm = calculateDescriptiveStatistics(events.map((event) => event.coordinates.depthKm));
  const reviewedCount = events.filter((event) => event.reviewStatus === 'reviewed').length;
  const withFeltReportsCount = events.filter(
    (event) => event.feltReports !== null && event.feltReports > 0,
  ).length;

  return {
    total: events.length,
    magnitudes,
    depthsKm,
    maximumMagnitude: magnitudes.maximum,
    averageDepthKm: depthsKm.mean,
    medianDepthKm: depthsKm.median,
    reviewedPercentage: percentage(reviewedCount, events.length),
    withFeltReportsPercentage: percentage(withFeltReportsCount, events.length),
    significantCount: events.filter((event) => event.significance >= 600).length,
    withAlertCount: events.filter((event) => event.alertLevel !== null).length,
  };
}

function startOfUtcBucket(date: Date, granularity: TimeGranularity): Date {
  const bucket = new Date(date.getTime());
  bucket.setUTCMinutes(0, 0, 0);
  if (granularity === 'hour') return bucket;

  bucket.setUTCHours(0, 0, 0, 0);
  if (granularity === 'day') return bucket;

  const daySinceMonday = (bucket.getUTCDay() + 6) % 7;
  bucket.setUTCDate(bucket.getUTCDate() - daySinceMonday);
  return bucket;
}

export function groupEventsByUtcTime(
  events: readonly EarthquakeEvent[],
  granularity: TimeGranularity,
): readonly TimeBucket[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const date = new Date(event.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = startOfUtcBucket(date, granularity).toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([startAt, count]) => ({ startAt, count }));
}
