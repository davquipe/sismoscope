import {
  Bookmark,
  CalendarClock,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileWarning,
  Pencil,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { usePreferencesStore } from '@/app/store/preferences-store';
import { REGION_PRESETS } from '@/entities/region/regions';
import {
  favoriteEarthquakeRepository,
  savedSearchRepository,
} from '@/entities/saved-search/repository';
import type {
  FavoriteEarthquake,
  SavedSearch,
  SavedSearchQuery,
} from '@/entities/saved-search/model';
import {
  createConfigurationExport,
  MAX_CONFIGURATION_IMPORT_BYTES,
  parseConfigurationImport,
  serializeConfigurationExport,
} from '@/shared/persistence/config-transfer';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { StatePanel } from '@/shared/ui/StatePanel';

import './saved.css';

interface SavedData {
  searches: SavedSearch[];
  favorites: FavoriteEarthquake[];
  recoveredInvalidRecords: number;
}

type PendingDeletion =
  { type: 'search'; id: string; label: string } | { type: 'favorite'; id: string; label: string };

async function readSavedData(): Promise<SavedData> {
  const [searchResult, favoriteResult] = await Promise.all([
    savedSearchRepository.list(),
    favoriteEarthquakeRepository.list(),
  ]);
  return {
    searches: searchResult.records,
    favorites: favoriteResult.records,
    recoveredInvalidRecords:
      searchResult.recoveredInvalidRecords + favoriteResult.recoveredInvalidRecords,
  };
}

function searchTimeLabel(query: SavedSearchQuery): string {
  if (query.timeRange.type === 'custom') {
    return 'Rango personalizado';
  }
  const labels = {
    hour: 'Última hora',
    day: 'Últimas 24 horas',
    week: 'Últimos 7 días',
    month: 'Últimos 30 días',
  } as const;
  return labels[query.timeRange.preset];
}

function searchRegionLabel(query: SavedSearchQuery): string {
  const filter = query.geographicFilter;
  if (filter.type === 'global') return 'Mundo';
  if (filter.type === 'preset') return REGION_PRESETS[filter.presetId].shortLabel;
  if (filter.type === 'rectangle') return 'Área rectangular';
  return `Radio de ${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(filter.radiusKm)} km`;
}

function searchFilterLabels(query: SavedSearchQuery): string[] {
  const labels = [searchTimeLabel(query), searchRegionLabel(query)];
  if (query.minMagnitude !== undefined) labels.push(`M ≥ ${query.minMagnitude}`);
  if (query.maxMagnitude !== undefined) labels.push(`M ≤ ${query.maxMagnitude}`);
  if (query.minDepthKm !== undefined) labels.push(`Prof. ≥ ${query.minDepthKm} km`);
  if (query.maxDepthKm !== undefined) labels.push(`Prof. ≤ ${query.maxDepthKm} km`);
  if (query.alertLevel !== undefined) labels.push(`Alerta ${query.alertLevel}`);
  if (query.reviewStatus !== undefined) {
    labels.push(query.reviewStatus === 'reviewed' ? 'Revisados' : 'Automáticos');
  }
  return labels;
}

function savedSearchExplorerUrl(search: SavedSearch): string {
  const { query } = search;

  const params = new URLSearchParams();
  if (query.timeRange.type === 'preset') {
    params.set('time', query.timeRange.preset);
  } else {
    params.set('time', 'custom');
    params.set('start', query.timeRange.startTime);
    params.set('end', query.timeRange.endTime);
  }

  const geographicFilter = query.geographicFilter;
  if (geographicFilter.type === 'global') {
    params.set('region', 'world');
  } else if (geographicFilter.type === 'preset') {
    params.set('region', geographicFilter.presetId);
  } else if (geographicFilter.type === 'rectangle') {
    params.set('minLat', geographicFilter.bounds.minLatitude.toFixed(4));
    params.set('maxLat', geographicFilter.bounds.maxLatitude.toFixed(4));
    params.set('minLon', geographicFilter.bounds.minLongitude.toFixed(4));
    params.set('maxLon', geographicFilter.bounds.maxLongitude.toFixed(4));
  } else {
    params.set('lat', geographicFilter.center.latitude.toFixed(4));
    params.set('lon', geographicFilter.center.longitude.toFixed(4));
    params.set('radius', String(geographicFilter.radiusKm));
  }

  if (query.minMagnitude !== undefined) params.set('minMag', String(query.minMagnitude));
  if (query.maxMagnitude !== undefined) params.set('maxMag', String(query.maxMagnitude));
  if (query.minDepthKm !== undefined) params.set('minDepth', String(query.minDepthKm));
  if (query.maxDepthKm !== undefined) params.set('maxDepth', String(query.maxDepthKm));
  if (query.minFelt !== undefined) params.set('felt', String(query.minFelt));
  if (query.minSignificance !== undefined) params.set('sig', String(query.minSignificance));
  if (query.alertLevel !== undefined) params.set('alert', query.alertLevel);
  if (query.reviewStatus !== undefined) params.set('review', query.reviewStatus);
  if (query.orderBy !== 'time') params.set('order', query.orderBy);
  if (query.pageSize === 25 || query.pageSize === 50) params.set('size', String(query.pageSize));
  params.set('view', 'split');
  return `/explorer?${params.toString()}`;
}

function mergeSearches(
  current: readonly SavedSearch[],
  imported: readonly SavedSearch[],
): SavedSearch[] {
  const records = new Map(current.map((search) => [search.id, search]));
  for (const search of imported) records.set(search.id, search);
  return [...records.values()];
}

function mergeFavorites(
  current: readonly FavoriteEarthquake[],
  imported: readonly FavoriteEarthquake[],
): FavoriteEarthquake[] {
  const records = new Map(current.map((favorite) => [favorite.earthquakeId, favorite]));
  for (const favorite of imported) records.set(favorite.earthquakeId, favorite);
  return [...records.values()];
}

export default function SavedPage() {
  const navigate = useNavigate();
  const preferences = usePreferencesStore((state) => state.preferences);
  const [data, setData] = useState<SavedData | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [renamingId, setRenamingId] = useState<string | undefined>();
  const [renameValue, setRenameValue] = useState('');
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | undefined>();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setData(await readSavedData());
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error ? error.message : 'No se pudieron leer los datos guardados.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    void readSavedData()
      .then((loadedData) => {
        if (isCurrent) setData(loadedData);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(
          error instanceof Error ? error.message : 'No se pudieron leer los datos guardados.',
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (dialog === null || pendingDeletion === undefined || dialog.open) return;
    dialog.showModal();
    deleteCancelRef.current?.focus();
  }, [pendingDeletion]);

  const runMutation = async (operation: () => Promise<void>, successMessage: string) => {
    setIsBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      await operation();
      setData(await readSavedData());
      setStatusMessage(successMessage);
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se pudo completar la operación local.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const submitRename = (event: FormEvent<HTMLFormElement>, search: SavedSearch) => {
    event.preventDefault();
    void runMutation(async () => {
      await savedSearchRepository.rename(search.id, renameValue);
      setRenamingId(undefined);
      setRenameValue('');
    }, 'Búsqueda renombrada.');
  };

  const runSearch = async (search: SavedSearch) => {
    const target = savedSearchExplorerUrl(search);
    setIsBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      await savedSearchRepository.markAsRun(search.id);
      void navigate(target);
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se pudo ejecutar la búsqueda guardada.',
      );
      setIsBusy(false);
    }
  };

  const closeDeleteDialog = () => {
    const dialog = deleteDialogRef.current;
    if (dialog?.open) dialog.close();
  };

  const confirmDeletion = async () => {
    if (pendingDeletion === undefined) return;
    const deletion = pendingDeletion;
    await runMutation(
      async () => {
        if (deletion.type === 'search') {
          await savedSearchRepository.remove(deletion.id);
        } else {
          await favoriteEarthquakeRepository.remove(deletion.id);
        }
        closeDeleteDialog();
      },
      deletion.type === 'search' ? 'Búsqueda eliminada.' : 'Favorito eliminado.',
    );
  };

  const exportConfiguration = () => {
    if (data === undefined) return;
    setActionError('');
    setStatusMessage('');
    try {
      const configuration = createConfigurationExport({
        preferences,
        savedSearches: data.searches,
        favorites: data.favorites,
      });
      const blob = new Blob([serializeConfigurationExport(configuration)], {
        type: 'application/json;charset=utf-8',
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `sismoscope-config-${configuration.exportedAt.slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setStatusMessage('Configuración exportada.');
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se pudo exportar la configuración.',
      );
    }
  };

  const importConfiguration = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file === undefined || data === undefined) return;

    if (file.size > MAX_CONFIGURATION_IMPORT_BYTES) {
      setStatusMessage('');
      setActionError('El archivo supera el límite de 5 MB.');
      return;
    }

    setIsBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      const parsed = parseConfigurationImport(await file.text());
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        setActionError(
          firstIssue === undefined
            ? parsed.error.message
            : `${parsed.error.message}: ${firstIssue.path || 'archivo'} — ${firstIssue.message}`,
        );
        return;
      }

      const mergedSearches = mergeSearches(data.searches, parsed.data.savedSearches);
      const mergedFavorites = mergeFavorites(data.favorites, parsed.data.favorites);
      try {
        await savedSearchRepository.replaceAll(mergedSearches);
        await favoriteEarthquakeRepository.replaceAll(mergedFavorites);
      } catch (error: unknown) {
        await Promise.allSettled([
          savedSearchRepository.replaceAll(data.searches),
          favoriteEarthquakeRepository.replaceAll(data.favorites),
        ]);
        throw error;
      }

      usePreferencesStore.setState({ preferences: parsed.data.preferences });
      setData(await readSavedData());
      setStatusMessage(
        `Importación completada: ${parsed.data.savedSearches.length} búsquedas y ${parsed.data.favorites.length} favoritos procesados.`,
      );
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : 'No se pudo importar la configuración.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="page saved-page">
      <header className="page-header saved-header">
        <div>
          <p className="eyebrow">BIBLIOTECA LOCAL</p>
          <h1>Guardados</h1>
          <p>
            Conserva consultas reproducibles y eventos de referencia. Los registros permanecen en
            este navegador y no incluyen respuestas completas de USGS.
          </p>
        </div>
        <div className="page-actions">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Seleccionar configuración JSON para importar"
            onChange={(event) => void importConfiguration(event)}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={data === undefined || isBusy}
          >
            <Upload size={15} aria-hidden="true" /> Importar JSON
          </Button>
          <Button
            variant="primary"
            onClick={exportConfiguration}
            disabled={data === undefined || isBusy}
          >
            <Download size={15} aria-hidden="true" /> Exportar
          </Button>
        </div>
      </header>

      <div className="saved-announcements" aria-live="polite" aria-atomic="true">
        {statusMessage ? (
          <p className="saved-notice saved-notice--success">
            <Check size={15} aria-hidden="true" /> {statusMessage}
          </p>
        ) : null}
      </div>
      {actionError ? (
        <div className="saved-notice saved-notice--error" role="alert">
          <FileWarning size={16} aria-hidden="true" />
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Cerrar mensaje">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="saved-loading" aria-busy="true" aria-label="Cargando elementos guardados">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <StatePanel
          type="error"
          title="No pudimos abrir tu biblioteca local"
          description={loadError}
          onRetry={() => void loadItems()}
        />
      ) : null}

      {!isLoading && data ? (
        <>
          {data.recoveredInvalidRecords > 0 ? (
            <p className="saved-recovery-note" role="status">
              Se omitieron {data.recoveredInvalidRecords}{' '}
              {data.recoveredInvalidRecords === 1
                ? 'registro local inválido'
                : 'registros locales inválidos'}{' '}
              para mantener la aplicación operativa.
            </p>
          ) : null}

          <section className="saved-overview" aria-label="Resumen de guardados">
            <div>
              <Search size={17} aria-hidden="true" />
              <span>
                <strong>{data.searches.length}</strong> búsquedas
              </span>
            </div>
            <div>
              <Bookmark size={17} aria-hidden="true" />
              <span>
                <strong>{data.favorites.length}</strong> favoritos
              </span>
            </div>
            <p>Persistencia local versionada · importación validada con esquema</p>
          </section>

          <div className="saved-grid">
            <section className="panel saved-panel" aria-labelledby="saved-searches-title">
              <div className="panel__header">
                <div>
                  <h2 id="saved-searches-title">Búsquedas guardadas</h2>
                  <p>Filtros que puedes restaurar en el explorador.</p>
                </div>
                <Badge>{data.searches.length}</Badge>
              </div>
              {data.searches.length === 0 ? (
                <StatePanel
                  type="empty"
                  title="Todavía no guardaste búsquedas"
                  description="Configura filtros en el explorador y guárdalos para volver a ejecutarlos desde aquí."
                />
              ) : (
                <div className="saved-search-list">
                  {data.searches.map((search) => {
                    const canExecute = savedSearchExplorerUrl(search) !== undefined;
                    return (
                      <article className="saved-search-item" key={search.id}>
                        <div className="saved-search-item__heading">
                          <div className="saved-search-item__icon" aria-hidden="true">
                            <Search size={17} />
                          </div>
                          <div>
                            {renamingId === search.id ? (
                              <form
                                className="saved-rename-form"
                                onSubmit={(event) => submitRename(event, search)}
                              >
                                <label className="sr-only" htmlFor={`rename-${search.id}`}>
                                  Nuevo nombre para {search.name}
                                </label>
                                <input
                                  id={`rename-${search.id}`}
                                  className="input"
                                  value={renameValue}
                                  maxLength={80}
                                  required
                                  autoFocus
                                  onChange={(event) => setRenameValue(event.target.value)}
                                />
                                <button
                                  type="submit"
                                  className="table-icon-action"
                                  disabled={isBusy}
                                  aria-label="Guardar nuevo nombre"
                                >
                                  <Check size={14} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="table-icon-action"
                                  onClick={() => setRenamingId(undefined)}
                                  aria-label="Cancelar cambio de nombre"
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </form>
                            ) : (
                              <h3>{search.name}</h3>
                            )}
                            <p>
                              Actualizada{' '}
                              <time dateTime={search.updatedAt}>
                                {formatDateTime(search.updatedAt, preferences.timeZone)}
                              </time>
                            </p>
                          </div>
                        </div>

                        <div className="saved-filter-list" aria-label={`Filtros de ${search.name}`}>
                          {searchFilterLabels(search.query).map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>

                        {!canExecute ? (
                          <p className="saved-item-warning">
                            El filtro circular se conserva, pero aún no puede restaurarse en la URL
                            del explorador.
                          </p>
                        ) : null}

                        <div className="saved-item-actions">
                          <Button
                            variant="primary"
                            onClick={() => void runSearch(search)}
                            disabled={!canExecute || isBusy}
                          >
                            <Play size={14} aria-hidden="true" /> Ejecutar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRenamingId(search.id);
                              setRenameValue(search.name);
                            }}
                            disabled={isBusy}
                          >
                            <Pencil size={14} aria-hidden="true" /> Renombrar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void runMutation(async () => {
                                await savedSearchRepository.duplicate(search.id);
                              }, 'Búsqueda duplicada.')
                            }
                            disabled={isBusy}
                          >
                            <Copy size={14} aria-hidden="true" /> Duplicar
                          </Button>
                          <button
                            type="button"
                            className="button button--ghost saved-delete-button"
                            disabled={isBusy}
                            onClick={(event) => {
                              setActionError('');
                              deleteTriggerRef.current = event.currentTarget;
                              setPendingDeletion({
                                type: 'search',
                                id: search.id,
                                label: search.name,
                              });
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" /> Eliminar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel saved-panel" aria-labelledby="favorites-title">
              <div className="panel__header">
                <div>
                  <h2 id="favorites-title">Eventos favoritos</h2>
                  <p>Referencias ligeras; los detalles actualizados proceden de USGS.</p>
                </div>
                <Badge tone="amber">{data.favorites.length}</Badge>
              </div>
              {data.favorites.length === 0 ? (
                <StatePanel
                  type="empty"
                  title="No hay eventos favoritos"
                  description="Usa el icono de marcador en una tabla o detalle para conservar una referencia local."
                />
              ) : (
                <div className="saved-favorite-list">
                  {data.favorites.map((favorite) => {
                    const snapshot = favorite.snapshot;
                    const label = snapshot?.place ?? favorite.earthquakeId;
                    return (
                      <article className="saved-favorite-item" key={favorite.earthquakeId}>
                        <div
                          className="saved-favorite-item__magnitude"
                          aria-label={`Magnitud ${formatNumber(snapshot?.magnitude)}`}
                        >
                          {snapshot?.magnitude === null || snapshot?.magnitude === undefined
                            ? '—'
                            : snapshot.magnitude.toFixed(1)}
                        </div>
                        <div className="saved-favorite-item__content">
                          <h3>{label}</h3>
                          <p className="mono">{favorite.earthquakeId}</p>
                          <p>
                            <CalendarClock size={13} aria-hidden="true" />
                            {snapshot ? (
                              <time dateTime={snapshot.occurredAt}>
                                {formatDateTime(snapshot.occurredAt, preferences.timeZone)}
                              </time>
                            ) : (
                              <span>
                                Guardado {formatDateTime(favorite.savedAt, preferences.timeZone)}
                              </span>
                            )}
                          </p>
                          {favorite.note ? <blockquote>{favorite.note}</blockquote> : null}
                        </div>
                        <div className="saved-favorite-item__actions">
                          {snapshot ? (
                            <Link
                              className="table-icon-action"
                              to={`/events/${encodeURIComponent(favorite.earthquakeId)}`}
                              state={{ detailUrl: snapshot.detailUrl }}
                              aria-label={`Abrir detalle de ${label}`}
                            >
                              <ExternalLink size={15} aria-hidden="true" />
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            className="table-icon-action saved-favorite-delete"
                            disabled={isBusy}
                            aria-label={`Eliminar ${label} de favoritos`}
                            onClick={(event) => {
                              setActionError('');
                              deleteTriggerRef.current = event.currentTarget;
                              setPendingDeletion({
                                type: 'favorite',
                                id: favorite.earthquakeId,
                                label,
                              });
                            }}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}

      <dialog
        ref={deleteDialogRef}
        className="saved-confirm-dialog"
        aria-labelledby="delete-saved-title"
        aria-describedby="delete-saved-description"
        onCancel={(event) => {
          event.preventDefault();
          closeDeleteDialog();
        }}
        onClose={() => {
          setPendingDeletion(undefined);
          deleteTriggerRef.current?.focus();
        }}
      >
        <div className="saved-confirm-dialog__icon" aria-hidden="true">
          <Trash2 size={20} />
        </div>
        <h2 id="delete-saved-title">
          ¿Eliminar {pendingDeletion?.type === 'search' ? 'la búsqueda' : 'el favorito'}?
        </h2>
        <p id="delete-saved-description">
          “{pendingDeletion?.label}” se quitará de este navegador. Los datos originales de USGS no
          se modifican.
        </p>
        {actionError ? (
          <p className="saved-confirm-dialog__error" role="alert">
            {actionError}
          </p>
        ) : null}
        <div className="button-row saved-confirm-dialog__actions">
          <button
            ref={deleteCancelRef}
            type="button"
            className="button button--secondary"
            onClick={closeDeleteDialog}
            disabled={isBusy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() => void confirmDeletion()}
            disabled={isBusy}
          >
            <Trash2 size={14} aria-hidden="true" />
            {isBusy ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
