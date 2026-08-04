import { z } from 'zod';

const finiteNumberSchema = z.number().finite();
const nullableFiniteNumberSchema = finiteNumberSchema.nullable();
const nonNegativeIntegerSchema = z.number().int().nonnegative();

export const usgsAlertLevelSchema = z.enum(['green', 'yellow', 'orange', 'red']);

export const usgsGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: z
    .tuple([finiteNumberSchema, finiteNumberSchema, finiteNumberSchema])
    .refine(
      ([longitude, latitude]) =>
        longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90,
      'Las coordenadas geográficas están fuera de rango.',
    ),
});

export const usgsSummaryPropertiesSchema = z.object({
  mag: nullableFiniteNumberSchema,
  magType: z.string().nullable(),
  place: z.string().nullable(),
  time: nonNegativeIntegerSchema,
  updated: nonNegativeIntegerSchema,
  url: z.string().url(),
  detail: z.string().url().optional(),
  felt: nonNegativeIntegerSchema.nullable(),
  cdi: nullableFiniteNumberSchema,
  mmi: nullableFiniteNumberSchema,
  alert: usgsAlertLevelSchema.nullable(),
  status: z.string(),
  tsunami: z.union([z.literal(0), z.literal(1)]),
  sig: nonNegativeIntegerSchema,
  net: z.string(),
  nst: nonNegativeIntegerSchema.nullable(),
  dmin: nullableFiniteNumberSchema,
  rms: nullableFiniteNumberSchema,
  gap: nullableFiniteNumberSchema,
  type: z.string(),
  title: z.string().optional(),
});

export const usgsFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string().min(1),
  properties: usgsSummaryPropertiesSchema,
  geometry: usgsGeometrySchema,
});

export const usgsCollectionMetadataSchema = z.object({
  generated: nonNegativeIntegerSchema,
  url: z.string().url(),
  title: z.string(),
  status: z.number().int().optional(),
  api: z.string().optional(),
  count: nonNegativeIntegerSchema.optional(),
});

export const usgsFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  metadata: usgsCollectionMetadataSchema,
  bbox: z
    .tuple([
      finiteNumberSchema,
      finiteNumberSchema,
      finiteNumberSchema,
      finiteNumberSchema,
      finiteNumberSchema,
      finiteNumberSchema,
    ])
    .nullable()
    .optional(),
  features: z.array(usgsFeatureSchema),
});

const usgsProductPropertyValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const usgsProductContentSchema = z.object({
  contentType: z.string().optional(),
  lastModified: nonNegativeIntegerSchema.optional(),
  length: nonNegativeIntegerSchema.optional(),
  url: z.string().url().optional(),
  sha256: z.string().optional(),
});

export const usgsProductSchema = z.object({
  id: z.string(),
  type: z.string(),
  code: z.string(),
  source: z.string(),
  updateTime: nonNegativeIntegerSchema,
  status: z.string(),
  preferredWeight: finiteNumberSchema,
  properties: z.record(z.string(), usgsProductPropertyValueSchema).optional().default({}),
  contents: z.record(z.string(), usgsProductContentSchema).optional().default({}),
});

export const usgsDetailPropertiesSchema = usgsSummaryPropertiesSchema.extend({
  products: z.record(z.string(), z.array(usgsProductSchema)).optional().default({}),
});

export const usgsDetailFeatureSchema = usgsFeatureSchema.extend({
  properties: usgsDetailPropertiesSchema,
});

export const usgsCountResponseSchema = z.object({
  count: nonNegativeIntegerSchema,
  maxAllowed: nonNegativeIntegerSchema.optional(),
});

export type UsgsFeature = z.infer<typeof usgsFeatureSchema>;
export type UsgsFeatureCollection = z.infer<typeof usgsFeatureCollectionSchema>;
export type UsgsDetailFeature = z.infer<typeof usgsDetailFeatureSchema>;
export type UsgsProduct = z.infer<typeof usgsProductSchema>;
