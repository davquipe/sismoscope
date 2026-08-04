import type { z } from 'zod';

import { PersistenceError } from '../errors/app-error';
import {
  favoriteEarthquakeSchema,
  preferenceRecordSchema,
  savedSearchSchema,
  type FavoriteEarthquake,
  type PreferenceRecord,
  type SavedSearch,
} from './schemas';

export const SISMO_SCOPE_DATABASE_NAME = 'sismoscope';
export const SISMO_SCOPE_DATABASE_VERSION = 2;

export const PERSISTENCE_STORES = {
  savedSearches: 'savedSearches',
  favoriteEarthquakes: 'favoriteEarthquakes',
  preferences: 'preferences',
} as const;

export type PersistenceStoreName = (typeof PERSISTENCE_STORES)[keyof typeof PERSISTENCE_STORES];

interface PersistenceRecordMap {
  [PERSISTENCE_STORES.savedSearches]: SavedSearch;
  [PERSISTENCE_STORES.favoriteEarthquakes]: FavoriteEarthquake;
  [PERSISTENCE_STORES.preferences]: PreferenceRecord;
}

const PERSISTENCE_RECORD_SCHEMAS: {
  [Store in PersistenceStoreName]: z.ZodType<PersistenceRecordMap[Store]>;
} = {
  [PERSISTENCE_STORES.savedSearches]: savedSearchSchema,
  [PERSISTENCE_STORES.favoriteEarthquakes]: favoriteEarthquakeSchema,
  [PERSISTENCE_STORES.preferences]: preferenceRecordSchema,
};

type PersistenceRecord<Store extends PersistenceStoreName> = PersistenceRecordMap[Store];

export interface PersistenceReadResult<RecordType> {
  records: RecordType[];
  invalidRecordCount: number;
}

export interface SismoScopeDatabaseOptions {
  name?: string;
  factory?: IDBFactory;
}

export class PersistenceUnavailableError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class PersistenceOperationError extends PersistenceError {
  constructor(
    readonly operation: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

function getGlobalIndexedDb(): IDBFactory {
  if (!('indexedDB' in globalThis) || globalThis.indexedDB === undefined) {
    throw new PersistenceUnavailableError('IndexedDB no está disponible en este entorno');
  }

  return globalThis.indexedDB;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createVersionOne(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(PERSISTENCE_STORES.savedSearches)) {
    database.createObjectStore(PERSISTENCE_STORES.savedSearches, {
      keyPath: 'id',
    });
  }

  if (!database.objectStoreNames.contains(PERSISTENCE_STORES.favoriteEarthquakes)) {
    database.createObjectStore(PERSISTENCE_STORES.favoriteEarthquakes, {
      keyPath: 'earthquakeId',
    });
  }
}

function migrateSavedSearchRecordsToVersionTwo(store: IDBObjectStore): void {
  const cursorRequest = store.openCursor();

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor === null) {
      return;
    }

    const value: unknown = cursor.value;
    if (isRecord(value)) {
      const createdAt = value.createdAt;
      const updatedAt = value.updatedAt;
      if (typeof updatedAt !== 'string' && typeof createdAt === 'string') {
        cursor.update({ ...value, updatedAt: createdAt });
      }
    }

    cursor.continue();
  };
}

function createVersionTwo(database: IDBDatabase, transaction: IDBTransaction): void {
  if (!database.objectStoreNames.contains(PERSISTENCE_STORES.preferences)) {
    database.createObjectStore(PERSISTENCE_STORES.preferences, {
      keyPath: 'key',
    });
  }

  const savedSearchStore = transaction.objectStore(PERSISTENCE_STORES.savedSearches);
  if (!savedSearchStore.indexNames.contains('name')) {
    savedSearchStore.createIndex('name', 'name', { unique: false });
  }
  if (!savedSearchStore.indexNames.contains('updatedAt')) {
    savedSearchStore.createIndex('updatedAt', 'updatedAt', { unique: false });
  }
  migrateSavedSearchRecordsToVersionTwo(savedSearchStore);

  const favoriteStore = transaction.objectStore(PERSISTENCE_STORES.favoriteEarthquakes);
  if (!favoriteStore.indexNames.contains('savedAt')) {
    favoriteStore.createIndex('savedAt', 'savedAt', { unique: false });
  }
}

export function migrationVersionsBetween(
  oldVersion: number,
  newVersion = SISMO_SCOPE_DATABASE_VERSION,
): readonly number[] {
  const versions: number[] = [];
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    if (version === 1 || version === 2) {
      versions.push(version);
    }
  }
  return versions;
}

export function migrateSismoScopeDatabase(
  database: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number,
): void {
  for (const version of migrationVersionsBetween(oldVersion, newVersion)) {
    if (version === 1) {
      createVersionOne(database);
    }
    if (version === 2) {
      createVersionTwo(database, transaction);
    }
  }
}

function schemaForStore<Store extends PersistenceStoreName>(
  store: Store,
): z.ZodType<PersistenceRecord<Store>> {
  return PERSISTENCE_RECORD_SCHEMAS[store];
}

function requestResult<Result>(request: IDBRequest<Result>, operation: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new PersistenceOperationError(
          operation,
          `No se pudo completar la operación local: ${operation}`,
          request.error,
        ),
      );
  });
}

function transactionCompletion(transaction: IDBTransaction, operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        new PersistenceOperationError(
          operation,
          `Falló la transacción local: ${operation}`,
          transaction.error,
        ),
      );
    transaction.onabort = () =>
      reject(
        new PersistenceOperationError(
          operation,
          `Se canceló la transacción local: ${operation}`,
          transaction.error,
        ),
      );
  });
}

export class SismoScopeDatabase {
  private databasePromise: Promise<IDBDatabase> | undefined;
  private readonly name: string;

  constructor(private readonly options: SismoScopeDatabaseOptions = {}) {
    this.name = options.name ?? SISMO_SCOPE_DATABASE_NAME;
  }

  async get<Store extends PersistenceStoreName>(
    storeName: Store,
    key: IDBValidKey,
  ): Promise<PersistenceRecord<Store> | undefined> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readonly');
    const rawValue: unknown = await requestResult(
      transaction.objectStore(storeName).get(key) as IDBRequest<unknown>,
      `leer ${storeName}`,
    );
    if (rawValue === undefined) {
      return undefined;
    }

    const parsed = schemaForStore(storeName).safeParse(rawValue);
    return parsed.success ? parsed.data : undefined;
  }

  async getAll<Store extends PersistenceStoreName>(
    storeName: Store,
  ): Promise<PersistenceReadResult<PersistenceRecord<Store>>> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readonly');
    const rawValues: unknown[] = await requestResult(
      transaction.objectStore(storeName).getAll() as IDBRequest<unknown[]>,
      `listar ${storeName}`,
    );
    const schema = schemaForStore(storeName);
    const records: PersistenceRecord<Store>[] = [];
    let invalidRecordCount = 0;

    for (const rawValue of rawValues) {
      const parsed = schema.safeParse(rawValue);
      if (parsed.success) {
        records.push(parsed.data);
      } else {
        invalidRecordCount += 1;
      }
    }

    return { records, invalidRecordCount };
  }

  async put<Store extends PersistenceStoreName>(
    storeName: Store,
    record: PersistenceRecord<Store>,
  ): Promise<void> {
    const validatedRecord = schemaForStore(storeName).parse(record);
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(validatedRecord);
    await transactionCompletion(transaction, `guardar en ${storeName}`);
  }

  async replaceAll<Store extends PersistenceStoreName>(
    storeName: Store,
    records: readonly PersistenceRecord<Store>[],
  ): Promise<void> {
    const schema = schemaForStore(storeName);
    const validatedRecords = records.map((record) => schema.parse(record));
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    const objectStore = transaction.objectStore(storeName);
    objectStore.clear();
    for (const record of validatedRecords) {
      objectStore.put(record);
    }
    await transactionCompletion(transaction, `reemplazar ${storeName}`);
  }

  async delete(storeName: PersistenceStoreName, key: IDBValidKey): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    await transactionCompletion(transaction, `eliminar de ${storeName}`);
  }

  async clear(storeName: PersistenceStoreName): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).clear();
    await transactionCompletion(transaction, `vaciar ${storeName}`);
  }

  async clearAll(): Promise<void> {
    const database = await this.open();
    const storeNames = Object.values(PERSISTENCE_STORES);
    const transaction = database.transaction(storeNames, 'readwrite');
    for (const storeName of storeNames) {
      transaction.objectStore(storeName).clear();
    }
    await transactionCompletion(transaction, 'borrar todos los datos locales');
  }

  async close(): Promise<void> {
    if (this.databasePromise !== undefined) {
      try {
        const database = await this.databasePromise;
        database.close();
      } finally {
        this.databasePromise = undefined;
      }
    }
  }

  private open(): Promise<IDBDatabase> {
    this.databasePromise ??= this.openDatabase().catch((error: unknown) => {
      this.databasePromise = undefined;
      throw error;
    });
    return this.databasePromise;
  }

  private openDatabase(): Promise<IDBDatabase> {
    let factory: IDBFactory;
    try {
      factory = this.options.factory ?? getGlobalIndexedDb();
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error
          ? error
          : new PersistenceUnavailableError('IndexedDB no está disponible', error),
      );
    }

    return new Promise((resolve, reject) => {
      const request = factory.open(this.name, SISMO_SCOPE_DATABASE_VERSION);

      request.onupgradeneeded = (event) => {
        const transaction = request.transaction;
        if (transaction === null) {
          reject(
            new PersistenceOperationError('migrar', 'No se pudo iniciar la migración de IndexedDB'),
          );
          return;
        }

        try {
          migrateSismoScopeDatabase(
            request.result,
            transaction,
            event.oldVersion,
            event.newVersion ?? SISMO_SCOPE_DATABASE_VERSION,
          );
        } catch (error: unknown) {
          transaction.abort();
          reject(
            new PersistenceOperationError(
              'migrar',
              'No se pudo migrar la base de datos local',
              error,
            ),
          );
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () =>
        reject(
          new PersistenceOperationError(
            'abrir',
            'No se pudo abrir la base de datos local',
            request.error,
          ),
        );
      request.onblocked = () =>
        reject(
          new PersistenceOperationError(
            'migrar',
            'Otra pestaña está bloqueando la actualización de datos locales',
          ),
        );
    });
  }
}

export const sismoScopeDatabase = new SismoScopeDatabase();
