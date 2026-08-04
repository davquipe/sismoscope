import {
  escapeCsvField,
  exportEarthquakesToCsv,
  exportEarthquakesToGeoJson,
} from '@/entities/earthquake';
import { normalizeUsgsFeature } from '@/shared/api/usgs';
import { describe, expect, it } from 'vitest';

import { usgsFeatureFixture } from '../../fixtures/usgs';

describe('earthquake exports', () => {
  it('escapes delimiters, quotes, newlines and spreadsheet formulas in CSV', () => {
    expect(escapeCsvField('Lima, "Perú"')).toBe('"Lima, ""Perú"""');
    expect(escapeCsvField('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
    expect(escapeCsvField('=2+2')).toBe("'=2+2");
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField(null)).toBe('');
  });

  it('exports ISO dates, source and query metadata to CSV', () => {
    const event = normalizeUsgsFeature({
      ...usgsFeatureFixture,
      properties: { ...usgsFeatureFixture.properties, place: 'Lima, "Perú"' },
    });
    const csv = exportEarthquakesToCsv([event], {
      generatedAt: '2024-02-01T00:00:00.000Z',
      queryDescription: 'Perú, M2.5+',
    });

    const [headers, row] = csv.split('\r\n');
    expect(headers).toContain('export_generated_at,data_source,query_description');
    expect(row).toContain('2024-01-01T00:00:00.000Z');
    expect(row).toContain('"Lima, ""Perú"""');
    expect(row).toContain('USGS Earthquake Hazards Program');
    expect(row).toContain('"Perú, M2.5+"');
  });

  it('uses GeoJSON longitude-latitude-depth coordinate order', () => {
    const event = normalizeUsgsFeature(usgsFeatureFixture);
    const geoJson = exportEarthquakesToGeoJson([event], {
      generatedAt: '2024-02-01T00:00:00.000Z',
    });

    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features[0]?.geometry.coordinates).toEqual([-77.0428, -12.0464, 33]);
    expect(geoJson.features[0]?.properties.magnitude).toBe(5.2);
  });
});
