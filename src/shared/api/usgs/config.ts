import type {
  RealtimeFeed,
  RealtimeFeedCategory,
  RealtimeFeedWindow,
} from '../../../entities/earthquake/model';

export const USGS_ENDPOINTS = {
  search: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  count: 'https://earthquake.usgs.gov/fdsnws/event/1/count',
  realtimeBase: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/',
} as const;

export const MAX_USGS_EVENTS = 20_000;
export const DEFAULT_SEARCH_PAGE_SIZE = 100;
export const DEFAULT_USGS_TIMEOUT_MS = 15_000;

export interface RealtimeFeedConfig {
  readonly id: RealtimeFeed;
  readonly category: RealtimeFeedCategory;
  readonly window: RealtimeFeedWindow;
  readonly url: string;
}

function createFeedConfig(
  id: RealtimeFeed,
  category: RealtimeFeedCategory,
  window: RealtimeFeedWindow,
): RealtimeFeedConfig {
  return {
    id,
    category,
    window,
    url: `${USGS_ENDPOINTS.realtimeBase}${id}.geojson`,
  };
}

export const REALTIME_FEEDS = {
  all_hour: createFeedConfig('all_hour', 'all', 'hour'),
  all_day: createFeedConfig('all_day', 'all', 'day'),
  all_week: createFeedConfig('all_week', 'all', 'week'),
  all_month: createFeedConfig('all_month', 'all', 'month'),
  significant_hour: createFeedConfig('significant_hour', 'significant', 'hour'),
  significant_day: createFeedConfig('significant_day', 'significant', 'day'),
  significant_week: createFeedConfig('significant_week', 'significant', 'week'),
  significant_month: createFeedConfig('significant_month', 'significant', 'month'),
  '1.0_hour': createFeedConfig('1.0_hour', '1.0', 'hour'),
  '1.0_day': createFeedConfig('1.0_day', '1.0', 'day'),
  '1.0_week': createFeedConfig('1.0_week', '1.0', 'week'),
  '1.0_month': createFeedConfig('1.0_month', '1.0', 'month'),
  '2.5_hour': createFeedConfig('2.5_hour', '2.5', 'hour'),
  '2.5_day': createFeedConfig('2.5_day', '2.5', 'day'),
  '2.5_week': createFeedConfig('2.5_week', '2.5', 'week'),
  '2.5_month': createFeedConfig('2.5_month', '2.5', 'month'),
  '4.5_hour': createFeedConfig('4.5_hour', '4.5', 'hour'),
  '4.5_day': createFeedConfig('4.5_day', '4.5', 'day'),
  '4.5_week': createFeedConfig('4.5_week', '4.5', 'week'),
  '4.5_month': createFeedConfig('4.5_month', '4.5', 'month'),
} as const satisfies Readonly<Record<RealtimeFeed, RealtimeFeedConfig>>;

export function getRealtimeFeedConfig(feed: RealtimeFeed): RealtimeFeedConfig {
  return REALTIME_FEEDS[feed];
}
