import type {
  BucketDistribution,
  DepthBucketId,
  EarthquakeEvent,
  EarthquakeStatistics,
  MagnitudeBucketId,
  TimeBucket,
  TimeGranularity,
} from '@/entities/earthquake';

export interface CategoryCount {
  readonly label: string;
  readonly count: number;
}

export interface AnalyticsResult {
  readonly statistics: EarthquakeStatistics;
  readonly timeSeries: readonly TimeBucket[];
  readonly magnitudeBuckets: BucketDistribution<MagnitudeBucketId>;
  readonly depthBuckets: BucketDistribution<DepthBucketId>;
  readonly magnitudeTypes: readonly CategoryCount[];
  readonly reviewStatuses: readonly CategoryCount[];
  readonly networks: readonly CategoryCount[];
  readonly magnitudeDepthScatter: readonly (readonly [number, number])[];
  readonly timeMagnitudeScatter: readonly (readonly [number, number])[];
}

export interface AnalyticsRequest {
  readonly type: 'calculate';
  readonly taskId: string;
  readonly events: readonly EarthquakeEvent[];
  readonly granularity: TimeGranularity;
}

export type AnalyticsWorkerResponse =
  | { readonly type: 'result'; readonly taskId: string; readonly result: AnalyticsResult }
  | { readonly type: 'error'; readonly taskId: string; readonly message: string };
