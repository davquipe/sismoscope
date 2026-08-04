import type {
  EarthquakeCollection,
  EarthquakeDetail,
  EarthquakeEvent,
  EarthquakeProduct,
  EarthquakeProductContent,
  GeographicBounds3D,
  ProductPropertyValue,
  ReviewStatus,
} from '../../../entities/earthquake/model';
import { createEarthquakeId } from '../../../entities/earthquake/model';
import { ValidationError } from '../../errors';
import { z } from 'zod';

import {
  type UsgsDetailFeature,
  type UsgsFeature,
  type UsgsProduct,
  usgsDetailFeatureSchema,
  usgsFeatureCollectionSchema,
  usgsFeatureSchema,
} from './schemas';
import { validateUsgsHttpsUrl } from './url-validation';

const UNKNOWN_PLACE = 'Ubicación no especificada';

function formatZodIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'respuesta';
    return `${path}: ${issue.message}`;
  });
}

function parseWithSchema<T>(parse: () => T, context: string): T {
  try {
    return parse();
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `USGS devolvió ${context} con un formato no válido.`,
        formatZodIssues(error),
        error,
      );
    }

    throw error;
  }
}

export function epochMillisecondsToUtcIso(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('USGS devolvió una fecha no válida.');
  }
  return date.toISOString();
}

function normalizeReviewStatus(status: string): ReviewStatus {
  switch (status.toLowerCase()) {
    case 'automatic':
      return 'automatic';
    case 'reviewed':
      return 'reviewed';
    case 'deleted':
      return 'deleted';
    default:
      return 'unknown';
  }
}

function normalizeFeature(feature: UsgsFeature, fallbackDetailUrl?: string): EarthquakeEvent {
  const [longitude, latitude, depthKm] = feature.geometry.coordinates;
  const trimmedPlace = feature.properties.place?.trim();
  const detailUrl = feature.properties.detail ?? fallbackDetailUrl;

  if (detailUrl === undefined) {
    throw new ValidationError('El evento de USGS no incluye una URL de detalle.');
  }

  return {
    id: createEarthquakeId(feature.id),
    magnitude: feature.properties.mag,
    magnitudeType: feature.properties.magType,
    place: trimmedPlace === undefined || trimmedPlace.length === 0 ? UNKNOWN_PLACE : trimmedPlace,
    occurredAt: epochMillisecondsToUtcIso(feature.properties.time),
    updatedAt: epochMillisecondsToUtcIso(feature.properties.updated),
    coordinates: { latitude, longitude, depthKm },
    significance: feature.properties.sig,
    feltReports: feature.properties.felt,
    alertLevel: feature.properties.alert,
    tsunamiFlag: feature.properties.tsunami === 1,
    reviewStatus: normalizeReviewStatus(feature.properties.status),
    sourceNetwork: feature.properties.net,
    detailUrl: validateUsgsHttpsUrl(detailUrl).toString(),
    webUrl: validateUsgsHttpsUrl(feature.properties.url).toString(),
    quality: {
      stationCount: feature.properties.nst,
      minimumDistance: feature.properties.dmin,
      rms: feature.properties.rms,
      azimuthalGap: feature.properties.gap,
    },
  };
}

export function normalizeUsgsFeature(input: unknown): EarthquakeEvent {
  const feature = parseWithSchema(() => usgsFeatureSchema.parse(input), 'un evento');
  return normalizeFeature(feature);
}

function normalizeBounds(
  bbox: readonly [number, number, number, number, number, number] | null | undefined,
): GeographicBounds3D | null {
  if (bbox === undefined || bbox === null) return null;
  const [minLongitude, minLatitude, minDepthKm, maxLongitude, maxLatitude, maxDepthKm] = bbox;
  return {
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
    minDepthKm,
    maxDepthKm,
  };
}

export function normalizeUsgsFeatureCollection(input: unknown): EarthquakeCollection {
  const collection = parseWithSchema(
    () => usgsFeatureCollectionSchema.parse(input),
    'una colección de eventos',
  );
  const events = collection.features.map((feature) => normalizeFeature(feature));

  return {
    events,
    total: events.length,
    metadata: {
      generatedAt: epochMillisecondsToUtcIso(collection.metadata.generated),
      title: collection.metadata.title,
      sourceUrl: collection.metadata.url,
      apiVersion: collection.metadata.api ?? null,
      httpStatus: collection.metadata.status ?? null,
      reportedCount: collection.metadata.count ?? events.length,
    },
    bounds: normalizeBounds(collection.bbox),
  };
}

function normalizeProductContent(
  key: string,
  content: UsgsProduct['contents'][string],
): EarthquakeProductContent {
  let safeUrl: string | null = null;
  if (content.url !== undefined) {
    try {
      safeUrl = validateUsgsHttpsUrl(content.url).toString();
    } catch (error: unknown) {
      if (!(error instanceof ValidationError)) throw error;
    }
  }

  return {
    key,
    contentType: content.contentType ?? null,
    lastModifiedAt:
      content.lastModified === undefined ? null : epochMillisecondsToUtcIso(content.lastModified),
    lengthBytes: content.length ?? null,
    url: safeUrl,
    sha256: content.sha256 ?? null,
  };
}

function normalizeProduct(product: UsgsProduct): EarthquakeProduct {
  const properties: Record<string, ProductPropertyValue> = {};
  for (const [key, value] of Object.entries(product.properties)) {
    properties[key] = value;
  }

  return {
    id: product.id,
    type: product.type,
    code: product.code,
    source: product.source,
    status: product.status,
    updatedAt: epochMillisecondsToUtcIso(product.updateTime),
    preferredWeight: product.preferredWeight,
    properties,
    contents: Object.entries(product.contents).map(([key, content]) =>
      normalizeProductContent(key, content),
    ),
  };
}

function normalizeDetail(feature: UsgsDetailFeature, originalUrl: string): EarthquakeDetail {
  return {
    event: normalizeFeature(feature, originalUrl),
    communityIntensity: feature.properties.cdi,
    instrumentalIntensity: feature.properties.mmi,
    products: Object.entries(feature.properties.products).map(([type, products]) => ({
      type,
      items: products.map(normalizeProduct),
    })),
    originalUrl,
  };
}

export function normalizeUsgsDetail(input: unknown, originalUrl: string): EarthquakeDetail {
  const feature = parseWithSchema(
    () => usgsDetailFeatureSchema.parse(input),
    'el detalle de un evento',
  );
  return normalizeDetail(feature, originalUrl);
}
