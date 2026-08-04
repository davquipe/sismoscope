import { z } from 'zod';

import {
  favoriteEarthquakeSchema,
  savedSearchSchema,
  userPreferencesSchema,
  type FavoriteEarthquake,
  type SavedSearch,
  type UserPreferences,
} from './schemas';

export const CONFIGURATION_EXPORT_VERSION = 1;
export const MAX_CONFIGURATION_IMPORT_BYTES = 5_000_000;

export const configurationExportSchema = z
  .object({
    schemaVersion: z.literal(CONFIGURATION_EXPORT_VERSION),
    exportedAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => value.endsWith('Z'), 'La fecha debe estar en UTC'),
    preferences: userPreferencesSchema,
    savedSearches: z.array(savedSearchSchema).max(1_000),
    favorites: z.array(favoriteEarthquakeSchema).max(10_000),
  })
  .strict();

export type ConfigurationExport = z.infer<typeof configurationExportSchema>;

export interface CreateConfigurationExportInput {
  preferences: UserPreferences;
  savedSearches: readonly SavedSearch[];
  favorites: readonly FavoriteEarthquake[];
  exportedAt?: Date;
}

export interface ConfigurationImportIssue {
  path: string;
  message: string;
}

export type ConfigurationImportResult =
  | { success: true; data: ConfigurationExport }
  | {
      success: false;
      error: {
        code: 'INVALID_JSON' | 'INVALID_CONFIGURATION' | 'FILE_TOO_LARGE';
        message: string;
        issues: readonly ConfigurationImportIssue[];
      };
    };

export function createConfigurationExport(
  input: CreateConfigurationExportInput,
): ConfigurationExport {
  return configurationExportSchema.parse({
    schemaVersion: CONFIGURATION_EXPORT_VERSION,
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    preferences: input.preferences,
    savedSearches: input.savedSearches,
    favorites: input.favorites,
  });
}

export function serializeConfigurationExport(configuration: ConfigurationExport): string {
  return JSON.stringify(configurationExportSchema.parse(configuration), null, 2);
}

export function parseConfigurationImport(serialized: string): ConfigurationImportResult {
  if (new TextEncoder().encode(serialized).byteLength > MAX_CONFIGURATION_IMPORT_BYTES) {
    return {
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'El archivo supera el límite de 5 MB',
        issues: [],
      },
    };
  }

  let rawConfiguration: unknown;
  try {
    rawConfiguration = JSON.parse(serialized);
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'El archivo no contiene JSON válido',
        issues: [],
      },
    };
  }

  const parsed = configurationExportSchema.safeParse(rawConfiguration);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: 'INVALID_CONFIGURATION',
        message: 'La configuración no tiene un formato compatible',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }

  return { success: true, data: parsed.data };
}
