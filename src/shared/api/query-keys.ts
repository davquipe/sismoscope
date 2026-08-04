import type { EarthquakeSearchQuery, RealtimeFeed } from '@/entities/earthquake/model/types';
import { buildUsgsCountUrl } from '@/shared/api/usgs';

export const earthquakeQueryKeys = {
  all: ['earthquakes'] as const,
  feeds: () => [...earthquakeQueryKeys.all, 'feed'] as const,
  feed: (feed: RealtimeFeed) => [...earthquakeQueryKeys.feeds(), feed] as const,
  searches: () => [...earthquakeQueryKeys.all, 'search'] as const,
  count: (query: EarthquakeSearchQuery) =>
    [...earthquakeQueryKeys.searches(), 'count', buildUsgsCountUrl(query)] as const,
  search: (query: EarthquakeSearchQuery) =>
    [...earthquakeQueryKeys.searches(), 'results', query] as const,
  detail: (eventId: string) => [...earthquakeQueryKeys.all, 'detail', eventId] as const,
  nearby: (eventId: string, radiusKm: number, days: number) =>
    [...earthquakeQueryKeys.all, 'nearby', eventId, radiusKm, days] as const,
};
