import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  preferencesStateStorage,
  type AsyncStateStorage,
} from '../../shared/persistence/state-storage';
import {
  autoRefreshPreferenceSchema,
  DEFAULT_USER_PREFERENCES,
  regionPresetIdSchema,
  userPreferencesSchema,
  type AutoRefreshPreference,
  type RegionPresetId,
  type UserPreferences,
} from '../../shared/persistence/schemas';

export type ThemePreference = UserPreferences['theme'];
export type TimeZonePreference = UserPreferences['timeZone'];
export type TableDensityPreference = UserPreferences['tableDensity'];

export interface PreferencesStore {
  preferences: UserPreferences;
  hasHydrated: boolean;
  setTheme(theme: ThemePreference): void;
  setTimeZone(timeZone: TimeZonePreference): void;
  setTableDensity(tableDensity: TableDensityPreference): void;
  setDefaultPageSize(defaultPageSize: number): void;
  setAutoRefresh(autoRefresh: AutoRefreshPreference): void;
  setReduceMotion(reduceMotion: boolean): void;
  setInitialRegion(initialRegion: RegionPresetId): void;
  resetPreferences(): void;
  setHasHydrated(hasHydrated: boolean): void;
}

type ResolvedTheme = Exclude<ThemePreference, 'system'>;
type MatchMedia = (query: string) => Pick<MediaQueryList, 'matches'>;

const STORE_NAME = 'sismoscope-preferences';
const STORE_VERSION = 1;

const safePreferencesStateStorage: AsyncStateStorage = {
  async getItem(name) {
    const serializedState = await preferencesStateStorage.getItem(name);
    if (serializedState === null) {
      return null;
    }

    try {
      JSON.parse(serializedState);
      return serializedState;
    } catch {
      await preferencesStateStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => preferencesStateStorage.setItem(name, value),
  removeItem: (name) => preferencesStateStorage.removeItem(name),
};

function updatePreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  return userPreferencesSchema.parse({ ...current, ...patch });
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      preferences: { ...DEFAULT_USER_PREFERENCES },
      hasHydrated: false,
      setTheme: (theme) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, { theme }),
        })),
      setTimeZone: (timeZone) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, { timeZone }),
        })),
      setTableDensity: (tableDensity) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, { tableDensity }),
        })),
      setDefaultPageSize: (defaultPageSize) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, {
            defaultPageSize,
          }),
        })),
      setAutoRefresh: (autoRefresh) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, {
            autoRefresh: autoRefreshPreferenceSchema.parse(autoRefresh),
          }),
        })),
      setReduceMotion: (reduceMotion) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, { reduceMotion }),
        })),
      setInitialRegion: (initialRegion) =>
        set((state) => ({
          preferences: updatePreferences(state.preferences, {
            initialRegion: regionPresetIdSchema.parse(initialRegion),
          }),
        })),
      resetPreferences: () => set({ preferences: { ...DEFAULT_USER_PREFERENCES } }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage: createJSONStorage(() => safePreferencesStateStorage),
      partialize: (state) => ({ preferences: state.preferences }),
      merge: (persistedState, currentState) => {
        const parsed = zodPreferencesFromPersistedState(persistedState);
        return parsed === undefined ? currentState : { ...currentState, preferences: parsed };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

function zodPreferencesFromPersistedState(persistedState: unknown): UserPreferences | undefined {
  if (
    typeof persistedState !== 'object' ||
    persistedState === null ||
    !('preferences' in persistedState)
  ) {
    return undefined;
  }

  const parsed = userPreferencesSchema.safeParse(persistedState.preferences);
  return parsed.success ? parsed.data : undefined;
}

export function resolveTheme(
  theme: ThemePreference,
  matchMedia: MatchMedia | undefined = 'matchMedia' in globalThis
    ? (query) => globalThis.matchMedia(query)
    : undefined,
): ResolvedTheme {
  if (theme !== 'system') {
    return theme;
  }
  return matchMedia?.('(prefers-color-scheme: dark)').matches === true ? 'dark' : 'light';
}

export function applyThemePreference(
  theme: ThemePreference,
  root: HTMLElement | undefined = 'document' in globalThis
    ? globalThis.document.documentElement
    : undefined,
): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme);
  if (root !== undefined) {
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }
  return resolvedTheme;
}
