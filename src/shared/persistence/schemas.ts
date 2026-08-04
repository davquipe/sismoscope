import { z } from 'zod';

import { validateUsgsDetailUrl } from '../api/usgs/url-validation';

const utcInstantSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => value.endsWith('Z'), 'La fecha debe estar expresada en UTC');

const finiteNumberSchema = z.number().finite();

export const regionPresetIdSchema = z.enum([
  'peru',
  'peru-coast',
  'peru-highlands',
  'peru-amazon',
  'pacific-ring',
  'world',
]);

export const geographicFilterSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('global') }).strict(),
    z
      .object({
        type: z.literal('preset'),
        presetId: regionPresetIdSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal('rectangle'),
        bounds: z
          .object({
            minLatitude: finiteNumberSchema.min(-90).max(90),
            maxLatitude: finiteNumberSchema.min(-90).max(90),
            minLongitude: finiteNumberSchema.min(-180).max(180),
            maxLongitude: finiteNumberSchema.min(-180).max(180),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        type: z.literal('circle'),
        center: z
          .object({
            latitude: finiteNumberSchema.min(-90).max(90),
            longitude: finiteNumberSchema.min(-180).max(180),
          })
          .strict(),
        radiusKm: finiteNumberSchema.positive().max(20_001.6),
      })
      .strict(),
  ])
  .superRefine((filter, context) => {
    if (filter.type === 'rectangle' && filter.bounds.minLatitude >= filter.bounds.maxLatitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La latitud mínima debe ser menor que la máxima',
        path: ['bounds', 'minLatitude'],
      });
    }

    if (filter.type === 'rectangle' && filter.bounds.minLongitude >= filter.bounds.maxLongitude) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La longitud mínima debe ser menor que la máxima',
        path: ['bounds', 'minLongitude'],
      });
    }
  });

export const savedSearchTimeRangeSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('preset'),
      preset: z.enum(['hour', 'day', 'week', 'month']),
    })
    .strict(),
  z
    .object({
      type: z.literal('custom'),
      startTime: utcInstantSchema,
      endTime: utcInstantSchema,
    })
    .strict()
    .superRefine((range, context) => {
      if (Date.parse(range.startTime) >= Date.parse(range.endTime)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El inicio debe ser anterior al final',
          path: ['startTime'],
        });
      }
    }),
]);

export const savedSearchQuerySchema = z
  .object({
    timeRange: savedSearchTimeRangeSchema,
    geographicFilter: geographicFilterSchema,
    minMagnitude: finiteNumberSchema.min(-10).max(12).optional(),
    maxMagnitude: finiteNumberSchema.min(-10).max(12).optional(),
    minDepthKm: finiteNumberSchema.min(-100).max(1_000).optional(),
    maxDepthKm: finiteNumberSchema.min(-100).max(1_000).optional(),
    minFelt: z.number().int().nonnegative().optional(),
    minSignificance: z.number().int().nonnegative().optional(),
    alertLevel: z.enum(['green', 'yellow', 'orange', 'red']).optional(),
    reviewStatus: z.enum(['automatic', 'reviewed']).optional(),
    orderBy: z.enum(['time', 'time-asc', 'magnitude', 'magnitude-asc']).default('time'),
    pageSize: z.number().int().min(10).max(500).default(100),
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.minMagnitude !== undefined &&
      query.maxMagnitude !== undefined &&
      query.minMagnitude > query.maxMagnitude
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La magnitud mínima no puede superar la máxima',
        path: ['minMagnitude'],
      });
    }

    if (
      query.minDepthKm !== undefined &&
      query.maxDepthKm !== undefined &&
      query.minDepthKm > query.maxDepthKm
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La profundidad mínima no puede superar la máxima',
        path: ['minDepthKm'],
      });
    }
  });

const savedSearchNameSchema = z.string().trim().min(1).max(80);

export const savedSearchSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: savedSearchNameSchema,
    query: savedSearchQuerySchema,
    createdAt: utcInstantSchema,
    updatedAt: utcInstantSchema,
    lastRunAt: utcInstantSchema.optional(),
  })
  .strict();

export const favoriteEarthquakeSnapshotSchema = z
  .object({
    place: z.string().min(1).max(500),
    magnitude: finiteNumberSchema.nullable(),
    occurredAt: utcInstantSchema,
    latitude: finiteNumberSchema.min(-90).max(90),
    longitude: finiteNumberSchema.min(-180).max(180),
    depthKm: finiteNumberSchema.min(-100).max(1_000),
    detailUrl: z
      .string()
      .url()
      .refine((value) => {
        try {
          validateUsgsDetailUrl(value);
          return true;
        } catch {
          return false;
        }
      }, 'La URL de detalle debe pertenecer al host oficial de USGS'),
  })
  .strict();

export const favoriteEarthquakeSchema = z
  .object({
    earthquakeId: z.string().trim().min(1).max(100),
    savedAt: utcInstantSchema,
    note: z.string().trim().max(500).optional(),
    snapshot: favoriteEarthquakeSnapshotSchema.optional(),
  })
  .strict();

export const autoRefreshPreferenceSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      intervalSeconds: z.union([
        z.literal(30),
        z.literal(60),
        z.literal(120),
        z.literal(300),
        z.literal(600),
      ]),
    })
    .strict(),
]);

export const userPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']),
    timeZone: z.enum(['utc', 'local']),
    tableDensity: z.enum(['comfortable', 'compact']),
    defaultPageSize: z.number().int().min(10).max(500),
    autoRefresh: autoRefreshPreferenceSchema,
    reduceMotion: z.boolean(),
    initialRegion: regionPresetIdSchema,
  })
  .strict();

export const preferenceRecordSchema = z
  .object({
    key: z.string().min(1).max(100),
    value: z.string().max(1_000_000),
    updatedAt: utcInstantSchema,
  })
  .strict();

export type RegionPresetId = z.infer<typeof regionPresetIdSchema>;
export type GeographicFilter = z.infer<typeof geographicFilterSchema>;
export type SavedSearchTimeRange = z.infer<typeof savedSearchTimeRangeSchema>;
export type SavedSearchQuery = z.infer<typeof savedSearchQuerySchema>;
export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type FavoriteEarthquakeSnapshot = z.infer<typeof favoriteEarthquakeSnapshotSchema>;
export type FavoriteEarthquake = z.infer<typeof favoriteEarthquakeSchema>;
export type AutoRefreshPreference = z.infer<typeof autoRefreshPreferenceSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type PreferenceRecord = z.infer<typeof preferenceRecordSchema>;

export const DEFAULT_USER_PREFERENCES: Readonly<UserPreferences> = {
  theme: 'system',
  timeZone: 'local',
  tableDensity: 'comfortable',
  defaultPageSize: 100,
  autoRefresh: { enabled: false },
  reduceMotion: false,
  initialRegion: 'peru',
};

export function normalizeSavedSearchName(name: string): string {
  return savedSearchNameSchema.parse(name);
}
