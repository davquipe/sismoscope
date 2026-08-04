import {
  DEFAULT_EXPLORER_FILTERS,
  filtersToSearchQuery,
  parseExplorerFilters,
  serializeExplorerFilters,
} from '@/features/search-earthquakes/url-state';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { describe, expect, it } from 'vitest';

describe('estado compartible del explorador', () => {
  it('normaliza parámetros inválidos sin propagar NaN ni estados imposibles', () => {
    const parsed = parseExplorerFilters(
      new URLSearchParams('time=decade&region=moon&page=-4&size=999&minMag=NaN&view=vr'),
    );

    expect(parsed).toEqual(DEFAULT_EXPLORER_FILTERS);
  });

  it('round-trips filtros relevantes y omite valores predeterminados', () => {
    const filters = {
      ...DEFAULT_EXPLORER_FILTERS,
      timeWindow: 'custom' as const,
      startTime: '2026-07-01T00:00:00.000Z',
      endTime: '2026-07-08T00:00:00.000Z',
      region: 'world' as const,
      geographicOverride: {
        type: 'rectangle' as const,
        bounds: {
          minLatitude: -20,
          maxLatitude: -5,
          minLongitude: -84,
          maxLongitude: -70,
        },
      },
      minMagnitude: 4.5,
      page: 3,
      pageSize: 50 as const,
      view: 'map' as const,
    };

    const serialized = serializeExplorerFilters(filters);
    expect(serialized.has('order')).toBe(false);
    expect(parseExplorerFilters(serialized)).toEqual(filters);
  });

  it('convierte página a offset USGS one-based y prioriza el rectángulo del mapa', () => {
    const query = filtersToSearchQuery(
      {
        ...DEFAULT_EXPLORER_FILTERS,
        timeWindow: 'week',
        region: 'world',
        geographicOverride: {
          type: 'rectangle',
          bounds: {
            minLatitude: -15,
            maxLatitude: -10,
            minLongitude: -80,
            maxLongitude: -75,
          },
        },
        page: 2,
        pageSize: 25,
      },
      Date.parse('2026-08-03T12:00:00.000Z'),
    );

    expect(query.startTime).toBe('2026-07-27T12:00:00.000Z');
    expect(query.endTime).toBe('2026-08-03T12:00:00.000Z');
    expect(query.offset).toBe(26);
    expect(query.geographic).toEqual({
      type: 'rectangle',
      bounds: {
        minLatitude: -15,
        maxLatitude: -10,
        minLongitude: -80,
        maxLongitude: -75,
      },
    });
  });

  it('serializa un radio sin mezclar parámetros rectangulares', () => {
    const serialized = serializeExplorerFilters({
      ...DEFAULT_EXPLORER_FILTERS,
      geographicOverride: {
        type: 'circle',
        center: { latitude: -12.0464, longitude: -77.0428 },
        radiusKm: 250,
      },
    });

    expect(serialized.get('radius')).toBe('250');
    expect(serialized.has('minLat')).toBe(false);
    expect(parseExplorerFilters(serialized).geographicOverride).toEqual({
      type: 'circle',
      center: { latitude: -12.0464, longitude: -77.0428 },
      radiusKm: 250,
    });
  });
});

describe('formato de presentación', () => {
  it('distingue cero de ausencia', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(null)).toBe('No disponible');
  });

  it('formatea UTC únicamente en presentación', () => {
    const rendered = formatDateTime('2026-08-03T12:30:00.000Z', 'utc');
    expect(rendered).toContain('2026');
    expect(rendered).toContain('12:30');
  });
});
