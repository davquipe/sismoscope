import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  ExternalLink,
  List,
  Map as MapIcon,
  MapPinned,
  PanelLeftClose,
  Save,
  Share2,
  SplitSquareVertical,
  X,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  buildEarthquakeExportFilename,
  exportEarthquakesToCsv,
  exportEarthquakesToGeoJson,
  type EarthquakeEvent,
} from '@/entities/earthquake';
import {
  FavoriteEarthquakeRepository,
  SavedSearchRepository,
} from '@/entities/saved-search/repository';
import { REGION_PRESETS } from '@/entities/region/regions';
import {
  DEFAULT_EXPLORER_FILTERS,
  filtersToSearchQuery,
  parseExplorerFilters,
  serializeExplorerFilters,
  type ExplorerFilters,
} from '@/features/search-earthquakes/url-state';
import { useEarthquakeSearch } from '@/features/search-earthquakes/queries';
import {
  formatCoordinates,
  formatDateTime,
  formatInteger,
  formatNumber,
} from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { StatePanel } from '@/shared/ui/StatePanel';
import { EarthquakeTable } from '@/widgets/earthquake-table/EarthquakeTable';
import { FilterPanel } from '@/widgets/filter-panel/FilterPanel';
import type { ViewportBounds } from '@/widgets/earthquake-map/EarthquakeMap';

const EarthquakeMap = lazy(() => import('@/widgets/earthquake-map/EarthquakeMap'));
const savedSearchRepository = new SavedSearchRepository();
const favoriteRepository = new FavoriteEarthquakeRepository();

function downloadText(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filtersToSavedQuery(filters: ExplorerFilters) {
  const timeRange =
    filters.timeWindow === 'custom' && filters.startTime && filters.endTime
      ? { type: 'custom' as const, startTime: filters.startTime, endTime: filters.endTime }
      : {
          type: 'preset' as const,
          preset: filters.timeWindow === 'custom' ? ('day' as const) : filters.timeWindow,
        };
  const geographicFilter =
    filters.geographicOverride?.type === 'rectangle'
      ? { type: 'rectangle' as const, bounds: filters.geographicOverride.bounds }
      : filters.geographicOverride?.type === 'circle'
        ? {
            type: 'circle' as const,
            center: filters.geographicOverride.center,
            radiusKm: filters.geographicOverride.radiusKm,
          }
        : { type: 'preset' as const, presetId: filters.region };
  return {
    timeRange,
    geographicFilter,
    ...(filters.minMagnitude !== null ? { minMagnitude: filters.minMagnitude } : {}),
    ...(filters.maxMagnitude !== null ? { maxMagnitude: filters.maxMagnitude } : {}),
    ...(filters.minDepthKm !== null ? { minDepthKm: filters.minDepthKm } : {}),
    ...(filters.maxDepthKm !== null ? { maxDepthKm: filters.maxDepthKm } : {}),
    ...(filters.minFelt !== null ? { minFelt: filters.minFelt } : {}),
    ...(filters.minSignificance !== null ? { minSignificance: filters.minSignificance } : {}),
    ...(filters.alertLevel !== 'all' ? { alertLevel: filters.alertLevel } : {}),
    ...(filters.reviewStatus !== 'all' ? { reviewStatus: filters.reviewStatus } : {}),
    orderBy: filters.orderBy,
    pageSize: filters.pageSize,
  };
}

export default function ExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseExplorerFilters(searchParams), [searchParams]);
  const query = useMemo(() => filtersToSearchQuery(filters), [filters]);
  const { countQuery, resultsQuery, canDownload, maximumAllowed } = useEarthquakeSearch(query);
  const [filterOpen, setFilterOpen] = useState(true);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const events = resultsQuery.data?.events ?? [];
  const selectedRaw = searchParams.get('event');
  const selected = events.find((event) => event.id === selectedRaw) ?? null;

  const updateFilters = (next: ExplorerFilters, preserveEvent = false) => {
    const params = serializeExplorerFilters(next);
    if (preserveEvent && selectedRaw) params.set('event', selectedRaw);
    setSearchParams(params);
  };

  const selectEvent = (event: EarthquakeEvent) => {
    const next = serializeExplorerFilters(filters);
    next.set('event', event.id);
    setSearchParams(next, { replace: true });
  };

  const saveSearch = async () => {
    if (!saveName.trim()) return;
    try {
      await savedSearchRepository.create({ name: saveName, query: filtersToSavedQuery(filters) });
      setSaveOpen(false);
      setSaveName('');
      setAnnouncement('Búsqueda guardada en este dispositivo.');
    } catch {
      setAnnouncement('No se pudo guardar la búsqueda. Verifica el nombre y vuelve a intentar.');
    }
  };

  const toggleFavorite = async (event: EarthquakeEvent) => {
    try {
      const result = await favoriteRepository.toggle({
        earthquakeId: event.id,
        snapshot: {
          place: event.place,
          magnitude: event.magnitude,
          occurredAt: event.occurredAt,
          latitude: event.coordinates.latitude,
          longitude: event.coordinates.longitude,
          depthKm: event.coordinates.depthKm,
          detailUrl: event.detailUrl,
        },
      });
      setAnnouncement(
        result.isFavorite ? 'Evento añadido a favoritos.' : 'Evento retirado de favoritos.',
      );
    } catch {
      setAnnouncement('No se pudo actualizar el favorito.');
    }
  };

  const exportCsv = () => {
    const generatedAt = new Date().toISOString();
    downloadText(
      exportEarthquakesToCsv(events, { generatedAt, queryDescription: searchParams.toString() }),
      buildEarthquakeExportFilename('csv', generatedAt),
      'text/csv;charset=utf-8',
    );
    setAnnouncement(`Se exportaron ${events.length} eventos en CSV.`);
  };

  const exportGeoJson = () => {
    const generatedAt = new Date().toISOString();
    downloadText(
      JSON.stringify(
        exportEarthquakesToGeoJson(events, {
          generatedAt,
          queryDescription: searchParams.toString(),
        }),
        null,
        2,
      ),
      buildEarthquakeExportFilename('geojson', generatedAt),
      'application/geo+json',
    );
    setAnnouncement(`Se exportaron ${events.length} eventos en GeoJSON.`);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAnnouncement('Enlace copiado al portapapeles.');
    } catch {
      setAnnouncement('No fue posible copiar automáticamente; usa la URL del navegador.');
    }
  };

  const setView = (view: ExplorerFilters['view']) => updateFilters({ ...filters, view }, true);
  const totalPages = Math.max(1, Math.ceil((countQuery.data ?? 0) / filters.pageSize));

  return (
    <div className="page page--wide explorer-page">
      <header className="page-header explorer-header">
        <div>
          <p className="eyebrow">CATÁLOGO INTERACTIVO</p>
          <h1>Explorador sísmico</h1>
          <p>
            Consulta el catálogo de USGS con filtros restaurables, conteo previo y selección
            sincronizada.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" onClick={share}>
            <Share2 size={15} aria-hidden="true" /> Compartir
          </Button>
          <Button onClick={() => setSaveOpen(true)}>
            <Save size={15} aria-hidden="true" /> Guardar
          </Button>
          <div className="export-actions">
            <Button disabled={!events.length} onClick={exportCsv}>
              <Download size={15} aria-hidden="true" /> CSV
            </Button>
            <Button disabled={!events.length} onClick={exportGeoJson}>
              GeoJSON
            </Button>
          </div>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {saveOpen ? (
        <section className="save-query-bar" aria-labelledby="save-query-title">
          <BookmarkPlus aria-hidden="true" />
          <div>
            <strong id="save-query-title">Guardar esta consulta</strong>
            <span>Los filtros se almacenarán sólo en este navegador.</span>
          </div>
          <label className="sr-only" htmlFor="save-name">
            Nombre
          </label>
          <input
            id="save-name"
            className="input"
            value={saveName}
            maxLength={80}
            placeholder="Ej. Actividad costa peruana"
            onChange={(event) => setSaveName(event.target.value)}
          />
          <Button variant="primary" onClick={() => void saveSearch()} disabled={!saveName.trim()}>
            Guardar
          </Button>
          <button
            className="icon-button"
            type="button"
            aria-label="Cancelar guardado"
            onClick={() => setSaveOpen(false)}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <div className={`explorer-layout${filterOpen ? '' : ' explorer-layout--filters-closed'}`}>
        {filterOpen ? (
          <aside className="explorer-filters" aria-label="Filtros">
            <FilterPanel
              filters={filters}
              onApply={updateFilters}
              onClear={() => updateFilters(DEFAULT_EXPLORER_FILTERS)}
            />
          </aside>
        ) : null}

        <section className="explorer-results" aria-label="Resultados">
          <div className="results-toolbar">
            <div className="results-toolbar__summary">
              <button
                className="icon-button"
                type="button"
                onClick={() => setFilterOpen((open) => !open)}
                aria-label={filterOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                aria-expanded={filterOpen}
              >
                <PanelLeftClose size={17} aria-hidden="true" />
              </button>
              <span>
                {countQuery.isPending ? (
                  <strong>Contando eventos…</strong>
                ) : (
                  <strong>{formatInteger(countQuery.data)} eventos encontrados</strong>
                )}
                <small>
                  {filters.geographicOverride?.type === 'rectangle'
                    ? 'Vista actual del mapa'
                    : filters.geographicOverride?.type === 'circle'
                      ? `Radio de ${formatNumber(filters.geographicOverride.radiusKm)} km`
                      : REGION_PRESETS[filters.region].label}{' '}
                  · {filters.timeWindow === 'custom' ? 'Rango personalizado' : filters.timeWindow}
                </small>
              </span>
            </div>
            <div className="segmented-control" aria-label="Vista de resultados">
              <button
                type="button"
                aria-pressed={filters.view === 'map'}
                onClick={() => setView('map')}
              >
                <MapIcon size={14} aria-hidden="true" /> Mapa
              </button>
              <button
                type="button"
                aria-pressed={filters.view === 'split'}
                onClick={() => setView('split')}
              >
                <SplitSquareVertical size={14} aria-hidden="true" /> Mixta
              </button>
              <button
                type="button"
                aria-pressed={filters.view === 'list'}
                onClick={() => setView('list')}
              >
                <List size={14} aria-hidden="true" /> Lista
              </button>
            </div>
          </div>

          {countQuery.isError ? (
            <StatePanel
              type={navigator.onLine ? 'error' : 'offline'}
              title="No se pudo contar la consulta"
              description="El conteo de seguridad falló. No descargaremos resultados hasta verificar el tamaño del conjunto."
              onRetry={() => void countQuery.refetch()}
            />
          ) : null}
          {countQuery.data !== undefined && countQuery.data > maximumAllowed ? (
            <StatePanel
              type="error"
              title="La consulta supera el límite de USGS"
              description={`Hay ${formatInteger(countQuery.data)} eventos y el servicio admite hasta ${formatInteger(maximumAllowed)} por consulta. Reduce el periodo, la zona o el rango de magnitud.`}
            />
          ) : null}
          {countQuery.data === 0 ? (
            <StatePanel
              type="empty"
              title="No hay eventos con estos criterios"
              description="Prueba ampliar el rango temporal o geográfico, o reducir la magnitud mínima."
            />
          ) : null}
          {canDownload && resultsQuery.isPending ? (
            <div className="results-loading" aria-busy="true">
              <span className="route-loading__pulse" />
              <span>Descargando página {filters.page}…</span>
            </div>
          ) : null}
          {resultsQuery.isError ? (
            <StatePanel
              type="error"
              title="No pudimos descargar los resultados"
              description="El conteo fue válido, pero la consulta de datos falló o devolvió un formato inesperado."
              onRetry={() => void resultsQuery.refetch()}
            />
          ) : null}

          {events.length ? (
            <div className={`results-workspace results-workspace--${filters.view}`}>
              {filters.view !== 'list' ? (
                <div className="results-map">
                  <Suspense fallback={<div className="skeleton results-map__fallback" />}>
                    <EarthquakeMap
                      events={events}
                      selectedId={selected?.id ?? null}
                      onSelect={selectEvent}
                      region={filters.region}
                      height="100%"
                      onViewportChange={setViewportBounds}
                    />
                  </Suspense>
                  {viewportBounds ? (
                    <Button
                      className="search-viewport-button"
                      variant="primary"
                      onClick={() =>
                        updateFilters({
                          ...filters,
                          geographicOverride: { type: 'rectangle', bounds: viewportBounds },
                          page: 1,
                        })
                      }
                    >
                      <MapPinned size={15} aria-hidden="true" /> Buscar en esta zona
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {filters.view !== 'map' ? (
                <div className="results-table">
                  <EarthquakeTable
                    events={events}
                    selectedId={selected?.id ?? null}
                    onSelect={selectEvent}
                    onFavorite={(event) => void toggleFavorite(event)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {events.length ? (
            <div className="results-pagination" aria-label="Paginación">
              <Button
                disabled={filters.page <= 1}
                onClick={() => updateFilters({ ...filters, page: filters.page - 1 })}
              >
                <ChevronLeft size={15} aria-hidden="true" /> Anterior
              </Button>
              <span>
                Página <strong>{filters.page}</strong> de <strong>{totalPages}</strong>
                <small>{events.length} registros en esta página</small>
              </span>
              <select
                className="select"
                aria-label="Resultados por página"
                value={filters.pageSize}
                onChange={(event) =>
                  updateFilters({
                    ...filters,
                    pageSize: Number(event.target.value) as ExplorerFilters['pageSize'],
                    page: 1,
                  })
                }
              >
                <option value="25">25 / página</option>
                <option value="50">50 / página</option>
                <option value="100">100 / página</option>
              </select>
              <Button
                disabled={filters.page >= totalPages}
                onClick={() => updateFilters({ ...filters, page: filters.page + 1 })}
              >
                Siguiente <ChevronRight size={15} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </section>

        {selected ? (
          <aside className="quick-detail" aria-labelledby="quick-detail-title">
            <div className="quick-detail__header">
              <Badge tone="teal">SELECCIONADO</Badge>
              <button
                className="icon-button"
                type="button"
                aria-label="Cerrar detalle rápido"
                onClick={() => {
                  const next = serializeExplorerFilters(filters);
                  setSearchParams(next, { replace: true });
                }}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="quick-detail__magnitude">
              <span>M</span>
              <strong>{selected.magnitude?.toFixed(1) ?? '—'}</strong>
              <small>{selected.magnitudeType ?? 'tipo no disponible'}</small>
            </div>
            <h2 id="quick-detail-title">{selected.place}</h2>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>{formatDateTime(selected.occurredAt)}</dd>
              </div>
              <div>
                <dt>Profundidad</dt>
                <dd>{formatNumber(selected.coordinates.depthKm, ' km')}</dd>
              </div>
              <div>
                <dt>Coordenadas</dt>
                <dd className="mono">
                  {formatCoordinates(selected.coordinates.latitude, selected.coordinates.longitude)}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{selected.reviewStatus === 'reviewed' ? 'Revisado' : 'Automático'}</dd>
              </div>
              <div>
                <dt>Significancia</dt>
                <dd>{selected.significance}</dd>
              </div>
            </dl>
            <Link
              className="button button--primary"
              to={`/events/${selected.id}`}
              state={{ detailUrl: selected.detailUrl }}
            >
              Abrir ficha completa <ExternalLink size={14} aria-hidden="true" />
            </Link>
            <Button onClick={() => void toggleFavorite(selected)}>
              <BookmarkPlus size={14} aria-hidden="true" /> Alternar favorito
            </Button>
            <button
              className="quick-detail__copy"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${selected.coordinates.latitude}, ${selected.coordinates.longitude}`,
                );
                setAnnouncement('Coordenadas copiadas.');
              }}
            >
              <Clipboard size={13} aria-hidden="true" /> Copiar coordenadas
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
