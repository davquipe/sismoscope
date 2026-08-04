import { PERSISTENCE_STORES, sismoScopeDatabase, type SismoScopeDatabase } from './database';

export interface AsyncStateStorage {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

function browserStorage(): Storage | undefined {
  if (!('localStorage' in globalThis)) {
    return undefined;
  }

  try {
    const storage = globalThis.localStorage;
    const probeKey = '__sismoscope_storage_probe__';
    storage.setItem(probeKey, probeKey);
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return undefined;
  }
}

export function createPreferencesStateStorage(
  database: SismoScopeDatabase = sismoScopeDatabase,
): AsyncStateStorage {
  const memoryFallback = new Map<string, string>();
  let indexedDbAvailable = true;

  const getFallback = (name: string): string | null => {
    const localStorage = browserStorage();
    return localStorage?.getItem(name) ?? memoryFallback.get(name) ?? null;
  };

  const setFallback = (name: string, value: string): void => {
    const localStorage = browserStorage();
    if (localStorage === undefined) {
      memoryFallback.set(name, value);
      return;
    }
    localStorage.setItem(name, value);
  };

  const removeFallback = (name: string): void => {
    browserStorage()?.removeItem(name);
    memoryFallback.delete(name);
  };

  return {
    async getItem(name) {
      if (indexedDbAvailable) {
        try {
          const record = await database.get(PERSISTENCE_STORES.preferences, name);
          return record?.value ?? getFallback(name);
        } catch {
          indexedDbAvailable = false;
        }
      }
      return getFallback(name);
    },

    async setItem(name, value) {
      if (indexedDbAvailable) {
        try {
          await database.put(PERSISTENCE_STORES.preferences, {
            key: name,
            value,
            updatedAt: new Date().toISOString(),
          });
          return;
        } catch {
          indexedDbAvailable = false;
        }
      }
      setFallback(name, value);
    },

    async removeItem(name) {
      if (indexedDbAvailable) {
        try {
          await database.delete(PERSISTENCE_STORES.preferences, name);
          removeFallback(name);
          return;
        } catch {
          indexedDbAvailable = false;
        }
      }
      removeFallback(name);
    },
  };
}

export const preferencesStateStorage = createPreferencesStateStorage();
