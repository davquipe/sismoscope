import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  migrationVersionsBetween,
  PERSISTENCE_STORES,
  SISMO_SCOPE_DATABASE_VERSION,
  SismoScopeDatabase,
} from './database';

function createLegacyVersionOneDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      const savedSearchStore = request.result.createObjectStore(PERSISTENCE_STORES.savedSearches, {
        keyPath: 'id',
      });
      request.result.createObjectStore(PERSISTENCE_STORES.favoriteEarthquakes, {
        keyPath: 'earthquakeId',
      });
      savedSearchStore.put({
        id: 'legacy-search',
        name: 'Consulta antigua',
        query: {
          timeRange: { type: 'preset', preset: 'day' },
          geographicFilter: { type: 'global' },
          orderBy: 'time',
          pageSize: 100,
        },
        createdAt: '2026-08-01T10:00:00.000Z',
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB v1'));
  });
}

function inspectDatabase(
  factory: IDBFactory,
  name: string,
): Promise<{
  version: number;
  stores: string[];
  searchIndexes: string[];
}> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(PERSISTENCE_STORES.savedSearches, 'readonly');
      const searchIndexes = Array.from(
        transaction.objectStore(PERSISTENCE_STORES.savedSearches).indexNames,
      );
      const result = {
        version: database.version,
        stores: Array.from(database.objectStoreNames),
        searchIndexes,
      };
      database.close();
      resolve(result);
    };
    request.onerror = () => reject(request.error ?? new Error('No se pudo inspeccionar IndexedDB'));
  });
}

describe('IndexedDB migrations', () => {
  it('plans only known migrations', () => {
    expect(migrationVersionsBetween(0)).toEqual([1, 2]);
    expect(migrationVersionsBetween(1)).toEqual([2]);
    expect(migrationVersionsBetween(2)).toEqual([]);
  });

  it('migrates v1 records and creates v2 stores and indexes', async () => {
    const factory = new IDBFactory();
    const databaseName = 'sismoscope-migration-test';
    await createLegacyVersionOneDatabase(factory, databaseName);

    const database = new SismoScopeDatabase({
      name: databaseName,
      factory,
    });
    const migratedSearch = await database.get(PERSISTENCE_STORES.savedSearches, 'legacy-search');

    expect(migratedSearch?.updatedAt).toBe('2026-08-01T10:00:00.000Z');
    await database.close();

    const structure = await inspectDatabase(factory, databaseName);
    expect(structure.version).toBe(SISMO_SCOPE_DATABASE_VERSION);
    expect(structure.stores).toEqual(expect.arrayContaining(Object.values(PERSISTENCE_STORES)));
    expect(structure.searchIndexes).toEqual(expect.arrayContaining(['name', 'updatedAt']));
  });
});
