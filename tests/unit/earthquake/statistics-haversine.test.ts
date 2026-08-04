import {
  calculateDescriptiveStatistics,
  createDepthBuckets,
  createMagnitudeBuckets,
  haversineDistanceKm,
  percentile,
} from '@/entities/earthquake';
import { describe, expect, it } from 'vitest';

describe('haversineDistanceKm', () => {
  it('calculates a great-circle distance and is symmetric', () => {
    const first = { latitude: 0, longitude: 0 };
    const second = { latitude: 0, longitude: 1 };
    expect(haversineDistanceKm(first, second)).toBeCloseTo(111.195, 3);
    expect(haversineDistanceKm(second, first)).toBeCloseTo(111.195, 3);
    expect(haversineDistanceKm(first, first)).toBe(0);
  });

  it('rejects coordinates outside geographic bounds', () => {
    expect(() =>
      haversineDistanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 }),
    ).toThrow(RangeError);
  });
});

describe('descriptive statistics', () => {
  it('uses R-7 percentiles and population standard deviation', () => {
    expect(percentile([0, 10], 25)).toBe(2.5);
    const statistics = calculateDescriptiveStatistics([1, 2, 3, null, Number.NaN]);
    expect(statistics).toMatchObject({
      count: 3,
      missingCount: 2,
      mean: 2,
      median: 2,
      minimum: 1,
      maximum: 3,
    });
    expect(statistics.standardDeviation).toBeCloseTo(Math.sqrt(2 / 3));
  });

  it('returns null metrics for an empty or unavailable dataset', () => {
    expect(calculateDescriptiveStatistics([null, undefined])).toMatchObject({
      count: 0,
      missingCount: 2,
      mean: null,
      median: null,
      standardDeviation: null,
    });
  });
});

describe('earthquake buckets', () => {
  it('uses non-overlapping magnitude boundaries', () => {
    const distribution = createMagnitudeBuckets([0.9, 1, 2.49, 2.5, 3.99, 4, 5.99, 6, null]);
    expect(distribution.buckets.map((bucket) => bucket.count)).toEqual([1, 2, 2, 2, 1]);
    expect(distribution.missingCount).toBe(1);
  });

  it('uses conventional shallow, intermediate and deep depth ranges', () => {
    const distribution = createDepthBuckets([-1, 0, 69.9, 70, 299.9, 300]);
    expect(distribution.buckets.map((bucket) => bucket.count)).toEqual([1, 2, 2, 1]);
  });
});
