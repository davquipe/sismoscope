import {
  assertCountWithinLimit,
  buildUsgsCountUrl,
  buildUsgsSearchUrl,
  serializeUsgsQuery,
  validateUsgsDetailUrl,
} from '@/shared/api/usgs';
import { QueryTooLargeError, ValidationError } from '@/shared/errors';
import { describe, expect, it } from 'vitest';

describe('USGS query builder', () => {
  it('serializes mandatory, temporal, numeric and rectangular parameters', () => {
    const parameters = serializeUsgsQuery(
      {
        startTime: '2024-01-01T00:00:00.000Z',
        endTime: '2024-01-31T23:59:59.999Z',
        minMagnitude: 2.5,
        maxMagnitude: 6,
        minDepthKm: 0,
        maxDepthKm: 300,
        geographic: {
          type: 'rectangle',
          bounds: {
            minLatitude: -18.5,
            maxLatitude: 0,
            minLongitude: -82,
            maxLongitude: -68,
          },
        },
        minFelt: 1,
        minSignificance: 100,
        alertLevel: 'green',
        reviewStatus: 'reviewed',
      },
      { includePagination: true },
    );

    expect(Object.fromEntries(parameters)).toEqual({
      format: 'geojson',
      eventtype: 'earthquake',
      jsonerror: 'true',
      starttime: '2024-01-01T00:00:00.000Z',
      endtime: '2024-01-31T23:59:59.999Z',
      minmagnitude: '2.5',
      maxmagnitude: '6',
      mindepth: '0',
      maxdepth: '300',
      minlatitude: '-18.5',
      maxlatitude: '0',
      minlongitude: '-82',
      maxlongitude: '-68',
      minfelt: '1',
      minsig: '100',
      alertlevel: 'green',
      reviewstatus: 'reviewed',
      limit: '100',
      offset: '1',
    });
  });

  it('serializes a circle without rectangular parameters', () => {
    const url = new URL(
      buildUsgsSearchUrl({
        geographic: {
          type: 'circle',
          center: { latitude: -12.0464, longitude: -77.0428 },
          radiusKm: 250,
        },
        orderBy: 'magnitude',
        limit: 25,
        offset: 26,
      }),
    );

    expect(url.searchParams.get('latitude')).toBe('-12.0464');
    expect(url.searchParams.get('longitude')).toBe('-77.0428');
    expect(url.searchParams.get('maxradiuskm')).toBe('250');
    expect(url.searchParams.get('minlatitude')).toBeNull();
    expect(url.searchParams.get('orderby')).toBe('magnitude');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('offset')).toBe('26');
  });

  it('omits pagination and ordering from the prior count', () => {
    const url = new URL(buildUsgsCountUrl({ orderBy: 'time-asc', limit: 25, offset: 51 }));
    expect(url.pathname.endsWith('/count')).toBe(true);
    expect(url.searchParams.get('format')).toBe('geojson');
    expect(url.searchParams.has('limit')).toBe(false);
    expect(url.searchParams.has('offset')).toBe(false);
    expect(url.searchParams.has('orderby')).toBe(false);
  });

  it('rejects inverted ranges and invalid pagination', () => {
    expect(() => serializeUsgsQuery({ minMagnitude: 5, maxMagnitude: 2 })).toThrow(ValidationError);
    expect(() => serializeUsgsQuery({ limit: 20_001 })).toThrow(ValidationError);
    expect(() => serializeUsgsQuery({ offset: 0 })).toThrow(ValidationError);
  });

  it('blocks counts above the USGS maximum', () => {
    expect(() => assertCountWithinLimit(20_001)).toThrow(QueryTooLargeError);
    expect(() => assertCountWithinLimit(20_000)).not.toThrow();
  });
});

describe('USGS detail URL validation', () => {
  it('accepts only the exact HTTPS allowlisted host', () => {
    expect(
      validateUsgsDetailUrl(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us-test.geojson#ignored',
      ).hash,
    ).toBe('');

    expect(() =>
      validateUsgsDetailUrl('https://earthquake.usgs.gov.attacker.example/detail/us-test.geojson'),
    ).toThrow(ValidationError);
    expect(() =>
      validateUsgsDetailUrl('http://earthquake.usgs.gov/detail/us-test.geojson'),
    ).toThrow(ValidationError);
    expect(() =>
      validateUsgsDetailUrl('https://user@earthquake.usgs.gov/detail/us-test.geojson'),
    ).toThrow(ValidationError);
  });
});
