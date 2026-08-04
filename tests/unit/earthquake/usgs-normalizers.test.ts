import {
  normalizeUsgsDetail,
  normalizeUsgsFeature,
  normalizeUsgsFeatureCollection,
  usgsFeatureCollectionSchema,
} from '@/shared/api/usgs';
import { ValidationError } from '@/shared/errors';
import { describe, expect, it } from 'vitest';

import { usgsCollectionFixture, usgsDetailFixture, usgsFeatureFixture } from '../../fixtures/usgs';

describe('USGS schemas and normalizers', () => {
  it('validates and normalizes a feed without leaking external names', () => {
    expect(usgsFeatureCollectionSchema.safeParse(usgsCollectionFixture).success).toBe(true);

    const collection = normalizeUsgsFeatureCollection(usgsCollectionFixture);
    const event = collection.events[0];
    expect(collection.total).toBe(1);
    expect(collection.metadata.generatedAt).toBe('2024-01-01T00:01:40.000Z');
    expect(collection.bounds).toEqual({
      minLatitude: -12.0464,
      maxLatitude: -12.0464,
      minLongitude: -77.0428,
      maxLongitude: -77.0428,
      minDepthKm: 33,
      maxDepthKm: 33,
    });
    expect(event).toMatchObject({
      id: 'us-test-1',
      magnitude: 5.2,
      occurredAt: '2024-01-01T00:00:00.000Z',
      reviewStatus: 'reviewed',
      tsunamiFlag: false,
      coordinates: { latitude: -12.0464, longitude: -77.0428, depthKm: 33 },
    });
  });

  it('keeps zero distinct from null and gives null places an explicit fallback', () => {
    const event = normalizeUsgsFeature({
      ...usgsFeatureFixture,
      properties: {
        ...usgsFeatureFixture.properties,
        place: null,
        mag: null,
        felt: 0,
        nst: 0,
      },
    });

    expect(event.place).toBe('Ubicación no especificada');
    expect(event.magnitude).toBeNull();
    expect(event.feltReports).toBe(0);
    expect(event.quality.stationCount).toBe(0);
  });

  it('accepts search metadata without count and derives the validated page size', () => {
    const searchResponse: unknown = {
      ...usgsCollectionFixture,
      metadata: {
        generated: usgsCollectionFixture.metadata.generated,
        url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
        title: 'USGS Earthquakes',
        status: 200,
        api: '2.7.0',
        limit: 100,
        offset: 1,
      },
    };

    const collection = normalizeUsgsFeatureCollection(searchResponse);
    expect(collection.total).toBe(1);
    expect(collection.metadata.reportedCount).toBe(1);
  });

  it('normalizes optional detail products and uses the validated request URL as fallback', () => {
    const originalUrl =
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us-test-1.geojson';
    const detail = normalizeUsgsDetail(usgsDetailFixture, originalUrl);

    expect(detail.event.detailUrl).toBe(originalUrl);
    expect(detail.communityIntensity).toBe(3.4);
    expect(detail.products).toHaveLength(1);
    expect(detail.products[0]?.items[0]).toMatchObject({
      type: 'origin',
      updatedAt: '2024-01-01T00:01:00.000Z',
    });
    expect(detail.products[0]?.items[0]?.contents[0]).toMatchObject({
      key: 'contents.xml',
      lengthBytes: 125,
    });
  });

  it('rejects corrupt coordinates at the external boundary', () => {
    const corrupt: unknown = {
      ...usgsFeatureFixture,
      geometry: { type: 'Point', coordinates: ['-77', -12, 33] },
    };
    expect(() => normalizeUsgsFeature(corrupt)).toThrow(ValidationError);
  });
});
