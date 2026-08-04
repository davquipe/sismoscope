/// <reference lib="webworker" />

import {
  calculateEarthquakeStatistics,
  createDepthBuckets,
  createMagnitudeBuckets,
  groupEventsByUtcTime,
} from '@/entities/earthquake';
import type { EarthquakeEvent } from '@/entities/earthquake';
import type {
  AnalyticsRequest,
  AnalyticsResult,
  AnalyticsWorkerResponse,
  CategoryCount,
} from '@/workers/analytics-types';

function countCategories(values: readonly string[]): readonly CategoryCount[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function calculateAnalytics(
  events: readonly EarthquakeEvent[],
  granularity: AnalyticsRequest['granularity'],
): AnalyticsResult {
  return {
    statistics: calculateEarthquakeStatistics(events),
    timeSeries: groupEventsByUtcTime(events, granularity),
    magnitudeBuckets: createMagnitudeBuckets(events.map((event) => event.magnitude)),
    depthBuckets: createDepthBuckets(events.map((event) => event.coordinates.depthKm)),
    magnitudeTypes: countCategories(events.map((event) => event.magnitudeType ?? 'No disponible')),
    reviewStatuses: countCategories(events.map((event) => event.reviewStatus)),
    networks: countCategories(events.map((event) => event.sourceNetwork || 'No disponible')),
    magnitudeDepthScatter: events.flatMap((event) =>
      event.magnitude === null ? [] : [[event.magnitude, event.coordinates.depthKm] as const],
    ),
    timeMagnitudeScatter: events.flatMap((event) =>
      event.magnitude === null ? [] : [[Date.parse(event.occurredAt), event.magnitude] as const],
    ),
  };
}

self.addEventListener('message', (event: MessageEvent<AnalyticsRequest>) => {
  const request = event.data;
  if (request.type !== 'calculate') return;
  try {
    const response: AnalyticsWorkerResponse = {
      type: 'result',
      taskId: request.taskId,
      result: calculateAnalytics(request.events, request.granularity),
    };
    self.postMessage(response);
  } catch (error: unknown) {
    const response: AnalyticsWorkerResponse = {
      type: 'error',
      taskId: request.taskId,
      message: error instanceof Error ? error.message : 'No se pudo calcular el análisis.',
    };
    self.postMessage(response);
  }
});
