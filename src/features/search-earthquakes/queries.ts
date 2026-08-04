import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { EarthquakeSearchQuery, RealtimeFeed } from '@/entities/earthquake/model/types';
import { earthquakeGateway } from '@/shared/api/gateway';
import { earthquakeQueryKeys } from '@/shared/api/query-keys';
import { MAX_USGS_EVENTS } from '@/shared/api/usgs';

export function useRealtimeFeed(feed: RealtimeFeed, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: earthquakeQueryKeys.feed(feed),
    queryFn: ({ signal }) => earthquakeGateway.getRealtimeFeed(feed, { signal }),
    staleTime: feed.endsWith('_hour') ? 60_000 : 5 * 60_000,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

export function useEarthquakeCount(query: EarthquakeSearchQuery, enabled = true) {
  return useQuery({
    queryKey: earthquakeQueryKeys.count(query),
    queryFn: ({ signal }) => earthquakeGateway.count(query, { signal }),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function useEarthquakeSearch(query: EarthquakeSearchQuery, enabled = true) {
  const countQuery = useEarthquakeCount(query, enabled);
  const canDownload =
    enabled &&
    countQuery.data !== undefined &&
    countQuery.data > 0 &&
    countQuery.data <= MAX_USGS_EVENTS;
  const resultsQuery = useQuery({
    queryKey: earthquakeQueryKeys.search(query),
    queryFn: ({ signal }) => earthquakeGateway.search(query, { signal }),
    enabled: canDownload,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  return { countQuery, resultsQuery, canDownload, maximumAllowed: MAX_USGS_EVENTS };
}

function safeDetailUrl(eventId: string): string | null {
  if (!/^[a-z0-9_-]{2,64}$/i.test(eventId)) return null;
  return `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${encodeURIComponent(eventId)}.geojson`;
}

export function useEarthquakeDetail(eventId: string | undefined, detailUrl?: string) {
  const validatedFallback = eventId ? safeDetailUrl(eventId) : null;
  const url = detailUrl ?? validatedFallback;
  return useQuery({
    queryKey: earthquakeQueryKeys.detail(eventId ?? 'invalid'),
    queryFn: ({ signal }) => {
      if (!url) throw new Error('El identificador del evento no es válido.');
      return earthquakeGateway.getDetail(url, { signal });
    },
    enabled: eventId !== undefined && url !== null,
    staleTime: 10 * 60_000,
  });
}
