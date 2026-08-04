declare const earthquakeIdBrand: unique symbol;

export type EarthquakeId = string & {
  readonly [earthquakeIdBrand]: 'EarthquakeId';
};

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

export type ReviewStatus = 'automatic' | 'reviewed' | 'deleted' | 'unknown';

export interface GeographicPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface EarthquakeCoordinates extends GeographicPoint {
  readonly depthKm: number;
}

export interface GeographicBounds {
  readonly minLatitude: number;
  readonly maxLatitude: number;
  readonly minLongitude: number;
  readonly maxLongitude: number;
}

export interface GeographicBounds3D extends GeographicBounds {
  readonly minDepthKm: number;
  readonly maxDepthKm: number;
}

export type GeographicFilter =
  | { readonly type: 'global' }
  | { readonly type: 'rectangle'; readonly bounds: GeographicBounds }
  | {
      readonly type: 'circle';
      readonly center: GeographicPoint;
      readonly radiusKm: number;
    };

export interface EarthquakeQuality {
  readonly stationCount: number | null;
  readonly minimumDistance: number | null;
  readonly rms: number | null;
  readonly azimuthalGap: number | null;
}

export interface EarthquakeEvent {
  readonly id: EarthquakeId;
  readonly magnitude: number | null;
  readonly magnitudeType: string | null;
  readonly place: string;
  readonly occurredAt: string;
  readonly updatedAt: string;
  readonly coordinates: EarthquakeCoordinates;
  readonly significance: number;
  readonly feltReports: number | null;
  readonly alertLevel: AlertLevel | null;
  readonly tsunamiFlag: boolean;
  readonly reviewStatus: ReviewStatus;
  readonly sourceNetwork: string;
  readonly detailUrl: string;
  readonly webUrl: string;
  readonly quality: EarthquakeQuality;
}

export interface EarthquakeCollectionMetadata {
  readonly generatedAt: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly apiVersion: string | null;
  readonly httpStatus: number | null;
  readonly reportedCount: number;
}

export interface EarthquakeCollection {
  readonly events: readonly EarthquakeEvent[];
  readonly total: number;
  readonly metadata: EarthquakeCollectionMetadata;
  readonly bounds: GeographicBounds3D | null;
}

export interface EarthquakeSearchPage {
  /** USGS offsets are one-based. */
  readonly offset: number;
  readonly limit: number;
  readonly returned: number;
  readonly hasMore: boolean;
}

export interface EarthquakeSearchResult extends EarthquakeCollection {
  readonly page: EarthquakeSearchPage;
}

export type ProductPropertyValue = string | number | boolean | null;

export interface EarthquakeProductContent {
  readonly key: string;
  readonly contentType: string | null;
  readonly lastModifiedAt: string | null;
  readonly lengthBytes: number | null;
  readonly url: string | null;
  readonly sha256: string | null;
}

export interface EarthquakeProduct {
  readonly id: string;
  readonly type: string;
  readonly code: string;
  readonly source: string;
  readonly status: string;
  readonly updatedAt: string;
  readonly preferredWeight: number;
  readonly properties: Readonly<Record<string, ProductPropertyValue>>;
  readonly contents: readonly EarthquakeProductContent[];
}

export interface EarthquakeProductGroup {
  readonly type: string;
  readonly items: readonly EarthquakeProduct[];
}

export interface EarthquakeDetail {
  readonly event: EarthquakeEvent;
  readonly communityIntensity: number | null;
  readonly instrumentalIntensity: number | null;
  readonly products: readonly EarthquakeProductGroup[];
  readonly originalUrl: string;
}

export type RealtimeFeedWindow = 'hour' | 'day' | 'week' | 'month';

export type RealtimeFeedCategory = 'all' | 'significant' | '1.0' | '2.5' | '4.5';

export type RealtimeFeed = `${RealtimeFeedCategory}_${RealtimeFeedWindow}`;

export type EarthquakeOrder = 'time' | 'time-asc' | 'magnitude' | 'magnitude-asc';

export type SearchReviewStatus = Extract<ReviewStatus, 'automatic' | 'reviewed'>;

export interface EarthquakeSearchQuery {
  readonly startTime?: string;
  readonly endTime?: string;
  readonly minMagnitude?: number;
  readonly maxMagnitude?: number;
  readonly minDepthKm?: number;
  readonly maxDepthKm?: number;
  readonly geographic?: GeographicFilter;
  readonly minFelt?: number;
  readonly minSignificance?: number;
  readonly alertLevel?: AlertLevel;
  readonly reviewStatus?: SearchReviewStatus;
  readonly orderBy?: EarthquakeOrder;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GatewayRequestOptions {
  readonly signal?: AbortSignal;
}

export interface EarthquakeGateway {
  getRealtimeFeed(
    feed: RealtimeFeed,
    options?: GatewayRequestOptions,
  ): Promise<EarthquakeCollection>;
  count(query: EarthquakeSearchQuery, options?: GatewayRequestOptions): Promise<number>;
  search(
    query: EarthquakeSearchQuery,
    options?: GatewayRequestOptions,
  ): Promise<EarthquakeSearchResult>;
  getDetail(detailUrl: string, options?: GatewayRequestOptions): Promise<EarthquakeDetail>;
}

export function createEarthquakeId(value: string): EarthquakeId {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RangeError('El identificador del sismo no puede estar vacío.');
  }

  // The assertion is confined to the constructor that enforces the brand invariant.
  return normalized as EarthquakeId;
}
