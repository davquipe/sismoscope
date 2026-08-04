import { describe, expect, it } from 'vitest';

import {
  createConfigurationExport,
  parseConfigurationImport,
  serializeConfigurationExport,
} from './config-transfer';
import { DEFAULT_USER_PREFERENCES, type SavedSearch } from './schemas';

const savedSearch: SavedSearch = {
  id: 'search-peru-day',
  name: 'Perú, últimas 24 horas',
  query: {
    timeRange: { type: 'preset', preset: 'day' },
    geographicFilter: { type: 'preset', presetId: 'peru' },
    minMagnitude: 3,
    orderBy: 'time',
    pageSize: 100,
  },
  createdAt: '2026-08-03T12:00:00.000Z',
  updatedAt: '2026-08-03T12:00:00.000Z',
};

describe('configuration transfer validation', () => {
  it('round-trips a valid configuration', () => {
    const configuration = createConfigurationExport({
      preferences: { ...DEFAULT_USER_PREFERENCES },
      savedSearches: [savedSearch],
      favorites: [],
      exportedAt: new Date('2026-08-03T15:30:00.000Z'),
    });

    const parsed = parseConfigurationImport(serializeConfigurationExport(configuration));

    expect(parsed).toEqual({ success: true, data: configuration });
  });

  it('reports malformed JSON without throwing', () => {
    const parsed = parseConfigurationImport('{"schemaVersion":');

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.code).toBe('INVALID_JSON');
    }
  });

  it('rejects unknown schema versions and unsafe extra fields', () => {
    const parsed = parseConfigurationImport(
      JSON.stringify({
        schemaVersion: 99,
        exportedAt: '2026-08-03T15:30:00.000Z',
        preferences: DEFAULT_USER_PREFERENCES,
        savedSearches: [],
        favorites: [],
        executable: '<script>alert(1)</script>',
      }),
    );

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.code).toBe('INVALID_CONFIGURATION');
      expect(parsed.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects contradictory ranges in an imported search', () => {
    const invalidSearch = {
      ...savedSearch,
      query: {
        ...savedSearch.query,
        minMagnitude: 7,
        maxMagnitude: 4,
      },
    };
    const parsed = parseConfigurationImport(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: '2026-08-03T15:30:00.000Z',
        preferences: DEFAULT_USER_PREFERENCES,
        savedSearches: [invalidSearch],
        favorites: [],
      }),
    );

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          path: 'savedSearches.0.query.minMagnitude',
        }),
      );
    }
  });
});
