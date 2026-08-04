import {
  PERSISTENCE_STORES,
  sismoScopeDatabase,
  type SismoScopeDatabase,
} from '../../shared/persistence/database';
import {
  favoriteEarthquakeSchema,
  normalizeSavedSearchName,
  savedSearchQuerySchema,
  savedSearchSchema,
  type FavoriteEarthquake,
  type FavoriteEarthquakeSnapshot,
  type SavedSearch,
  type SavedSearchQuery,
} from '../../shared/persistence/schemas';

export interface CreateSavedSearchInput {
  name: string;
  query: SavedSearchQuery;
}

export interface UpdateSavedSearchInput {
  name?: string;
  query?: SavedSearchQuery;
  markAsRun?: boolean;
}

export interface AddFavoriteInput {
  earthquakeId: string;
  note?: string;
  snapshot?: FavoriteEarthquakeSnapshot;
}

export interface FavoriteToggleResult {
  isFavorite: boolean;
  favorite?: FavoriteEarthquake;
}

export interface PersistenceListResult<RecordType> {
  records: RecordType[];
  recoveredInvalidRecords: number;
}

export class SavedItemNotFoundError extends Error {
  readonly code = 'SAVED_ITEM_NOT_FOUND';

  constructor(
    readonly itemId: string,
    itemType: 'search' | 'favorite',
  ) {
    super(
      itemType === 'search'
        ? 'No se encontró la búsqueda guardada'
        : 'No se encontró el evento favorito',
    );
    this.name = 'SavedItemNotFoundError';
  }
}

type Clock = () => Date;
type IdFactory = () => string;

function defaultIdFactory(): string {
  return globalThis.crypto.randomUUID();
}

function toUtcInstant(date: Date): string {
  return date.toISOString();
}

function copyName(name: string): string {
  const suffix = ' (copia)';
  return `${name.slice(0, 80 - suffix.length)}${suffix}`;
}

export class SavedSearchRepository {
  constructor(
    private readonly database: SismoScopeDatabase = sismoScopeDatabase,
    private readonly clock: Clock = () => new Date(),
    private readonly createId: IdFactory = defaultIdFactory,
  ) {}

  async list(): Promise<PersistenceListResult<SavedSearch>> {
    const result = await this.database.getAll(PERSISTENCE_STORES.savedSearches);
    return {
      records: [...result.records].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
      recoveredInvalidRecords: result.invalidRecordCount,
    };
  }

  get(id: string): Promise<SavedSearch | undefined> {
    return this.database.get(PERSISTENCE_STORES.savedSearches, id);
  }

  async create(input: CreateSavedSearchInput): Promise<SavedSearch> {
    const now = toUtcInstant(this.clock());
    const savedSearch = savedSearchSchema.parse({
      id: this.createId(),
      name: normalizeSavedSearchName(input.name),
      query: savedSearchQuerySchema.parse(input.query),
      createdAt: now,
      updatedAt: now,
    });
    await this.database.put(PERSISTENCE_STORES.savedSearches, savedSearch);
    return savedSearch;
  }

  async update(id: string, input: UpdateSavedSearchInput): Promise<SavedSearch> {
    const current = await this.requireSearch(id);
    const now = toUtcInstant(this.clock());
    const updated = savedSearchSchema.parse({
      ...current,
      name: input.name === undefined ? current.name : normalizeSavedSearchName(input.name),
      query: input.query === undefined ? current.query : savedSearchQuerySchema.parse(input.query),
      updatedAt: now,
      lastRunAt: input.markAsRun === true ? now : current.lastRunAt,
    });
    await this.database.put(PERSISTENCE_STORES.savedSearches, updated);
    return updated;
  }

  rename(id: string, name: string): Promise<SavedSearch> {
    return this.update(id, { name });
  }

  markAsRun(id: string): Promise<SavedSearch> {
    return this.update(id, { markAsRun: true });
  }

  async duplicate(id: string, name?: string): Promise<SavedSearch> {
    const source = await this.requireSearch(id);
    return this.create({
      name: name ?? copyName(source.name),
      query: source.query,
    });
  }

  remove(id: string): Promise<void> {
    return this.database.delete(PERSISTENCE_STORES.savedSearches, id);
  }

  async replaceAll(searches: readonly SavedSearch[]): Promise<void> {
    const validatedSearches = searches.map((search) => savedSearchSchema.parse(search));
    await this.database.replaceAll(PERSISTENCE_STORES.savedSearches, validatedSearches);
  }

  private async requireSearch(id: string): Promise<SavedSearch> {
    const search = await this.get(id);
    if (search === undefined) {
      throw new SavedItemNotFoundError(id, 'search');
    }
    return search;
  }
}

export class FavoriteEarthquakeRepository {
  constructor(
    private readonly database: SismoScopeDatabase = sismoScopeDatabase,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async list(): Promise<PersistenceListResult<FavoriteEarthquake>> {
    const result = await this.database.getAll(PERSISTENCE_STORES.favoriteEarthquakes);
    return {
      records: [...result.records].sort((left, right) => right.savedAt.localeCompare(left.savedAt)),
      recoveredInvalidRecords: result.invalidRecordCount,
    };
  }

  get(earthquakeId: string): Promise<FavoriteEarthquake | undefined> {
    return this.database.get(PERSISTENCE_STORES.favoriteEarthquakes, earthquakeId);
  }

  async isFavorite(earthquakeId: string): Promise<boolean> {
    return (await this.get(earthquakeId)) !== undefined;
  }

  async add(input: AddFavoriteInput): Promise<FavoriteEarthquake> {
    const favorite = favoriteEarthquakeSchema.parse({
      ...input,
      savedAt: toUtcInstant(this.clock()),
    });
    await this.database.put(PERSISTENCE_STORES.favoriteEarthquakes, favorite);
    return favorite;
  }

  remove(earthquakeId: string): Promise<void> {
    return this.database.delete(PERSISTENCE_STORES.favoriteEarthquakes, earthquakeId);
  }

  async toggle(input: AddFavoriteInput): Promise<FavoriteToggleResult> {
    if (await this.isFavorite(input.earthquakeId)) {
      await this.remove(input.earthquakeId);
      return { isFavorite: false };
    }

    const favorite = await this.add(input);
    return { isFavorite: true, favorite };
  }

  async updateNote(earthquakeId: string, note: string | undefined): Promise<FavoriteEarthquake> {
    const current = await this.get(earthquakeId);
    if (current === undefined) {
      throw new SavedItemNotFoundError(earthquakeId, 'favorite');
    }
    const updated = favoriteEarthquakeSchema.parse({
      ...current,
      note,
    });
    await this.database.put(PERSISTENCE_STORES.favoriteEarthquakes, updated);
    return updated;
  }

  async replaceAll(favorites: readonly FavoriteEarthquake[]): Promise<void> {
    const validatedFavorites = favorites.map((favorite) =>
      favoriteEarthquakeSchema.parse(favorite),
    );
    await this.database.replaceAll(PERSISTENCE_STORES.favoriteEarthquakes, validatedFavorites);
  }
}

export const savedSearchRepository = new SavedSearchRepository();
export const favoriteEarthquakeRepository = new FavoriteEarthquakeRepository();
