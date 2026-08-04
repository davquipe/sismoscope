import {
  Activity,
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  Clipboard,
  Database,
  Download,
  ExternalLink,
  Gauge,
  MapPinned,
  MessageCircle,
  Radio,
  RefreshCw,
  Ruler,
  ShieldCheck,
  TriangleAlert,
  Waves,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { usePreferencesStore } from '@/app/store/preferences-store';
import {
  distanceBetweenEarthquakesKm,
  type EarthquakeDetail,
  type EarthquakeEvent,
  type EarthquakeSearchQuery,
} from '@/entities/earthquake';
import { favoriteEarthquakeRepository } from '@/entities/saved-search/repository';
import { useEarthquakeDetail, useEarthquakeSearch } from '@/features/search-earthquakes/queries';
import {
  formatCoordinates,
  formatDateTime,
  formatInteger,
  formatNumber,
} from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { StatePanel } from '@/shared/ui/StatePanel';

import './event-detail.css';

const EarthquakeMap = lazy(() => import('@/widgets/earthquake-map/EarthquakeMap'));

const EVENT_ID_PATTERN = /^[a-z0-9_-]{2,64}$/i;
const NEARBY_RESULT_LIMIT = 100;
const NEARBY_DISPLAY_LIMIT = 20;
const RADIUS_OPTIONS = [50, 100, 250, 500] as const;
const DAY_OPTIONS = [1, 3, 7, 14] as const;

type NearbyRadius = (typeof RADIUS_OPTIONS)[number];
type NearbyDays = (typeof DAY_OPTIONS)[number];

interface NearbySettings {
  readonly radiusKm: NearbyRadius;
  readonly days: NearbyDays;
}

interface NearbyResult {
  readonly event: EarthquakeEvent;
  readonly distanceKm: number;
  readonly timeDifferenceMs: number;
  readonly occurredBefore: boolean;
}

interface FavoriteLookup {
  readonly eventId: string;
  readonly status: 'favorite' | 'not-favorite' | 'error';
}

function readDetailUrl(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('detailUrl' in state)) return undefined;
  const detailUrl = state.detailUrl;
  return typeof detailUrl === 'string' && detailUrl.trim().length > 0 ? detailUrl : undefined;
}

function parseRadius(value: string): NearbyRadius {
  const parsed = Number(value);
  return RADIUS_OPTIONS.find((option) => option === parsed) ?? 100;
}

function parseDays(value: string): NearbyDays {
  const parsed = Number(value);
  return DAY_OPTIONS.find((option) => option === parsed) ?? 7;
}

function reviewStatusLabel(status: EarthquakeEvent['reviewStatus']): string {
  switch (status) {
    case 'automatic':
      return 'Automático';
    case 'reviewed':
      return 'Revisado';
    case 'deleted':
      return 'Eliminado por la fuente';
    case 'unknown':
      return 'No determinado';
  }
}

function formatTemporalSeparation(result: NearbyResult): string {
  if (result.timeDifferenceMs === 0) return 'Mismo instante reportado';
  const totalMinutes = Math.max(1, Math.round(result.timeDifferenceMs / 60_000));
  const direction = result.occurredBefore ? 'antes' : 'después';
  if (totalMinutes < 60) return `${totalMinutes} min ${direction}`;
  const hours = totalMinutes / 60;
  if (hours < 48) return `${formatNumber(hours)} h ${direction}`;
  return `${formatNumber(hours / 24)} días ${direction}`;
}

function downloadDetail(detail: EarthquakeDetail): void {
  const exportedAt = new Date().toISOString();
  const payload = JSON.stringify(
    {
      metadata: {
        source: 'USGS Earthquake Hazards Program',
        exportedAt,
        originalUrl: detail.event.webUrl,
      },
      detail,
    },
    null,
    2,
  );
  const objectUrl = URL.createObjectURL(
    new Blob([payload], { type: 'application/json;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `sismoscope-event-${detail.event.id}-${exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function DetailDatum({
  label,
  children,
  mono = false,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly mono?: boolean;
}) {
  return (
    <div className="detail-datum">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="event-detail-loading" aria-label="Cargando detalle del evento" aria-busy="true">
      <div className="skeleton event-detail-loading__hero" />
      <div className="event-detail-loading__grid">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}

function ProductSection({ detail }: { readonly detail: EarthquakeDetail }) {
  return (
    <section className="panel detail-products" aria-labelledby="products-title">
      <div className="panel__header">
        <div>
          <h2 id="products-title">Productos técnicos disponibles</h2>
          <p>Archivos y revisiones publicados para este evento por las redes de origen.</p>
        </div>
        <Badge tone="blue">{detail.products.length} grupos</Badge>
      </div>

      {detail.products.length === 0 ? (
        <div className="detail-products__empty">
          <Database size={22} aria-hidden="true" />
          <p>USGS no incluyó productos adicionales en esta respuesta.</p>
        </div>
      ) : (
        <div className="detail-products__groups">
          {detail.products.map((group) => (
            <details className="product-group" key={group.type}>
              <summary>
                <span>{group.type}</span>
                <Badge>{group.items.length}</Badge>
              </summary>
              <div className="product-group__items">
                {group.items.map((product) => (
                  <article className="product-item" key={product.id}>
                    <div className="product-item__heading">
                      <div>
                        <strong>
                          {product.source.toUpperCase()} · {product.code}
                        </strong>
                        <span>{product.status}</span>
                      </div>
                      <time dateTime={product.updatedAt}>
                        {formatDateTime(product.updatedAt, 'utc')}
                      </time>
                    </div>
                    <p>
                      Peso preferido: {formatNumber(product.preferredWeight)} ·{' '}
                      {Object.keys(product.properties).length} propiedades ·{' '}
                      {product.contents.length} archivos
                    </p>
                    {product.contents.length > 0 ? (
                      <ul className="product-contents">
                        {product.contents.map((content) => (
                          <li key={content.key}>
                            {content.url ? (
                              <a href={content.url} target="_blank" rel="noopener noreferrer">
                                {content.key} <ExternalLink size={12} aria-hidden="true" />
                              </a>
                            ) : (
                              <span>{content.key}</span>
                            )}
                            <small>
                              {content.contentType ?? 'tipo no indicado'}
                              {content.lengthBytes === null
                                ? ''
                                : ` · ${formatInteger(content.lengthBytes)} bytes`}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function NearbyEventsSection({ anchor }: { readonly anchor: EarthquakeEvent }) {
  const [draftRadius, setDraftRadius] = useState<NearbyRadius>(100);
  const [draftDays, setDraftDays] = useState<NearbyDays>(7);
  const [settings, setSettings] = useState<NearbySettings>({ radiusKm: 100, days: 7 });

  const query = useMemo<EarthquakeSearchQuery>(() => {
    const occurredAt = Date.parse(anchor.occurredAt);
    const windowMs = settings.days * 24 * 60 * 60_000;
    return {
      startTime: new Date(occurredAt - windowMs).toISOString(),
      endTime: new Date(occurredAt + windowMs).toISOString(),
      geographic: {
        type: 'circle',
        center: {
          latitude: anchor.coordinates.latitude,
          longitude: anchor.coordinates.longitude,
        },
        radiusKm: settings.radiusKm,
      },
      orderBy: 'time',
      limit: NEARBY_RESULT_LIMIT,
      offset: 1,
    };
  }, [anchor, settings.days, settings.radiusKm]);

  const { countQuery, resultsQuery, canDownload, maximumAllowed } = useEarthquakeSearch(query);
  const nearbyEvents = useMemo<readonly NearbyResult[]>(() => {
    if (resultsQuery.isPlaceholderData) return [];
    const anchorTime = Date.parse(anchor.occurredAt);
    return (resultsQuery.data?.events ?? [])
      .filter((event) => event.id !== anchor.id)
      .map((event) => {
        const eventTime = Date.parse(event.occurredAt);
        return {
          event,
          distanceKm: distanceBetweenEarthquakesKm(anchor, event),
          timeDifferenceMs: Math.abs(eventTime - anchorTime),
          occurredBefore: eventTime < anchorTime,
        };
      })
      .filter((result) => result.distanceKm <= settings.radiusKm)
      .sort(
        (first, second) =>
          first.distanceKm - second.distanceKm || first.timeDifferenceMs - second.timeDifferenceMs,
      )
      .slice(0, NEARBY_DISPLAY_LIMIT);
  }, [anchor, resultsQuery.data?.events, resultsQuery.isPlaceholderData, settings.radiusKm]);

  const controlsChanged = draftRadius !== settings.radiusKm || draftDays !== settings.days;
  const count = countQuery.data;

  return (
    <section className="panel nearby-events" aria-labelledby="nearby-title">
      <div className="panel__header nearby-events__header">
        <div>
          <h2 id="nearby-title">Eventos cercanos en tiempo y espacio</h2>
          <p>
            Consulta independiente de USGS; la proximidad no implica relación causal entre eventos.
          </p>
        </div>
        {count !== undefined ? (
          <Badge tone="teal">{formatInteger(count)} registros USGS</Badge>
        ) : null}
      </div>

      <div className="nearby-controls">
        <div className="field">
          <label htmlFor="nearby-radius">Radio desde el epicentro</label>
          <select
            className="select"
            id="nearby-radius"
            value={draftRadius}
            onChange={(event) => setDraftRadius(parseRadius(event.target.value))}
          >
            {RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>
                {radius} km
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nearby-days">Ventana alrededor del evento</label>
          <select
            className="select"
            id="nearby-days"
            value={draftDays}
            onChange={(event) => setDraftDays(parseDays(event.target.value))}
          >
            {DAY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                ± {days} {days === 1 ? 'día' : 'días'}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="primary"
          disabled={!controlsChanged || countQuery.isFetching || resultsQuery.isFetching}
          onClick={() => setSettings({ radiusKm: draftRadius, days: draftDays })}
        >
          <RefreshCw size={14} aria-hidden="true" /> Actualizar cercanos
        </Button>
      </div>

      <p className="nearby-events__method">
        Distancia superficial calculada con Haversine. La profundidad se compara por separado. Se
        excluye el evento actual de la lista.
      </p>

      {countQuery.isPending ? (
        <div className="nearby-events__loading" aria-live="polite">
          <span className="route-loading__pulse" /> Contando eventos en la zona…
        </div>
      ) : null}
      {countQuery.isError ? (
        <StatePanel
          type="error"
          title="No se pudo consultar la zona cercana"
          description="El conteo previo falló; no se descargarán eventos hasta verificar el tamaño de la consulta."
          onRetry={() => void countQuery.refetch()}
        />
      ) : null}
      {count !== undefined && count > maximumAllowed ? (
        <StatePanel
          type="error"
          title="La consulta cercana es demasiado amplia"
          description={`USGS reportó ${formatInteger(count)} eventos. Reduce el radio o la ventana temporal para quedar por debajo de ${formatInteger(maximumAllowed)}.`}
        />
      ) : null}
      {count === 0 ? (
        <StatePanel
          type="empty"
          title="No hay eventos en esta selección"
          description="USGS no devolvió registros para este radio y ventana temporal."
        />
      ) : null}
      {canDownload && (resultsQuery.isPending || resultsQuery.isPlaceholderData) ? (
        <div className="nearby-events__loading" aria-live="polite">
          <span className="route-loading__pulse" /> Descargando eventos cercanos…
        </div>
      ) : null}
      {resultsQuery.isError ? (
        <StatePanel
          type="error"
          title="No se pudieron descargar los eventos cercanos"
          description="USGS respondió al conteo, pero la página de resultados falló o no superó la validación."
          onRetry={() => void resultsQuery.refetch()}
        />
      ) : null}
      {resultsQuery.isSuccess && !resultsQuery.isPlaceholderData && nearbyEvents.length === 0 ? (
        <StatePanel
          type="empty"
          title="No hay otros eventos en esta selección"
          description={`No se encontraron otros eventos en ${settings.radiusKm} km y ± ${settings.days} días dentro de la página consultada.`}
        />
      ) : null}

      {nearbyEvents.length > 0 ? (
        <div className="nearby-list">
          {count !== undefined && count > NEARBY_RESULT_LIMIT ? (
            <p className="nearby-list__limit">
              USGS reportó más de {NEARBY_RESULT_LIMIT} registros. Esta vista compara la primera
              página y muestra los {NEARBY_DISPLAY_LIMIT} más próximos de ella.
            </p>
          ) : null}
          {nearbyEvents.map((result) => (
            <article className="nearby-item" key={result.event.id}>
              <div
                className="nearby-item__magnitude"
                aria-label={`Magnitud ${formatNumber(result.event.magnitude)}`}
              >
                {result.event.magnitude?.toFixed(1) ?? '—'}
              </div>
              <div className="nearby-item__body">
                <h3>
                  <Link
                    to={`/events/${result.event.id}`}
                    state={{ detailUrl: result.event.detailUrl }}
                  >
                    {result.event.place}
                  </Link>
                </h3>
                <p>
                  <span>
                    <Ruler size={12} aria-hidden="true" /> {formatNumber(result.distanceKm, ' km')}
                  </span>
                  <span>
                    <Activity size={12} aria-hidden="true" /> {formatTemporalSeparation(result)}
                  </span>
                  <span>
                    {formatNumber(result.event.coordinates.depthKm, ' km')} de profundidad
                  </span>
                </p>
              </div>
              <Link
                className="nearby-item__open"
                to={`/events/${result.event.id}`}
                state={{ detailUrl: result.event.detailUrl }}
                aria-label={`Abrir detalle de ${result.event.place}`}
              >
                <ExternalLink size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const detailUrl = readDetailUrl(location.state);
  const validEventId =
    eventId !== undefined && EVENT_ID_PATTERN.test(eventId) ? eventId : undefined;
  const detailQuery = useEarthquakeDetail(validEventId, detailUrl);
  const detail = detailQuery.data;
  const event = detail?.event;
  const preferredTimeZone = usePreferencesStore((state) => state.preferences.timeZone);
  const [announcement, setAnnouncement] = useState('');
  const [favoriteLookup, setFavoriteLookup] = useState<FavoriteLookup | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);

  useEffect(() => {
    if (event === undefined) return;
    let active = true;
    void favoriteEarthquakeRepository
      .isFavorite(event.id)
      .then((isFavorite) => {
        if (active) {
          setFavoriteLookup({
            eventId: event.id,
            status: isFavorite ? 'favorite' : 'not-favorite',
          });
        }
      })
      .catch(() => {
        if (active) setFavoriteLookup({ eventId: event.id, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [event]);

  const favoriteStatus =
    event !== undefined && favoriteLookup?.eventId === event.id
      ? favoriteLookup.status
      : 'checking';

  const goBack = (): void => {
    if (location.key === 'default') void navigate('/explorer');
    else void navigate(-1);
  };

  const copyCoordinates = async (): Promise<void> => {
    if (event === undefined) return;
    try {
      if (navigator.clipboard === undefined) throw new Error('Clipboard no disponible');
      await navigator.clipboard.writeText(
        `${event.coordinates.latitude}, ${event.coordinates.longitude}`,
      );
      setAnnouncement('Coordenadas copiadas al portapapeles.');
    } catch {
      setAnnouncement('No se pudieron copiar las coordenadas automáticamente.');
    }
  };

  const toggleFavorite = async (): Promise<void> => {
    if (event === undefined || savingFavorite) return;
    setSavingFavorite(true);
    try {
      const result = await favoriteEarthquakeRepository.toggle({
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
      setFavoriteLookup({
        eventId: event.id,
        status: result.isFavorite ? 'favorite' : 'not-favorite',
      });
      setAnnouncement(
        result.isFavorite ? 'Evento añadido a favoritos.' : 'Evento retirado de favoritos.',
      );
    } catch {
      setAnnouncement('No se pudo actualizar el favorito en este dispositivo.');
    } finally {
      setSavingFavorite(false);
    }
  };

  const exportDetail = (): void => {
    if (detail === undefined) return;
    try {
      downloadDetail(detail);
      setAnnouncement('Registro normalizado descargado como JSON.');
    } catch {
      setAnnouncement('No se pudo generar la descarga JSON en este navegador.');
    }
  };

  if (validEventId === undefined) {
    return (
      <div className="page event-detail-page">
        <StatePanel
          type="error"
          title="Identificador de evento no válido"
          description="El enlace no contiene un identificador USGS que SismoScope pueda consultar de forma segura."
        />
      </div>
    );
  }

  if (detailQuery.isPending) {
    return (
      <div className="page event-detail-page">
        <DetailLoading />
      </div>
    );
  }

  if (detailQuery.isError || detail === undefined || event === undefined) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div className="page event-detail-page">
        <button className="detail-back" type="button" onClick={goBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Volver
        </button>
        <StatePanel
          type={offline ? 'offline' : 'error'}
          title="El detalle del evento no está disponible"
          description="El evento pudo actualizarse, eliminarse o devolver información incompleta. También es posible que USGS no responda temporalmente."
          onRetry={() => void detailQuery.refetch()}
        />
      </div>
    );
  }

  const missingTechnicalFields = [
    event.magnitude,
    event.magnitudeType,
    detail.communityIntensity,
    detail.instrumentalIntensity,
  ].filter((value) => value === null).length;
  const isFavorite = favoriteStatus === 'favorite';

  return (
    <div className="page event-detail-page">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <button className="detail-back" type="button" onClick={goBack}>
        <ArrowLeft size={15} aria-hidden="true" /> Volver a resultados
      </button>

      <header className="event-detail-hero">
        <div className="event-detail-hero__magnitude">
          <span>MAGNITUD</span>
          <strong>{event.magnitude?.toFixed(1) ?? '—'}</strong>
          <small>{event.magnitudeType ?? 'tipo no disponible'}</small>
        </div>
        <div className="event-detail-hero__main">
          <p className="eyebrow">FICHA TÉCNICA · {event.sourceNetwork.toUpperCase()}</p>
          <h1>{event.place}</h1>
          <div className="event-detail-hero__badges">
            <Badge tone={event.reviewStatus === 'reviewed' ? 'teal' : 'neutral'}>
              {reviewStatusLabel(event.reviewStatus)}
            </Badge>
            {event.alertLevel ? (
              <Badge
                tone={
                  event.alertLevel === 'red'
                    ? 'critical'
                    : event.alertLevel === 'green'
                      ? 'teal'
                      : 'amber'
                }
              >
                PAGER {event.alertLevel.toUpperCase()}
              </Badge>
            ) : (
              <Badge>Sin nivel PAGER disponible</Badge>
            )}
            {event.tsunamiFlag ? <Badge tone="blue">Fuente marca tsunami</Badge> : null}
            {detailQuery.isFetching ? <Badge>Actualizando…</Badge> : null}
          </div>
          <p>
            Magnitud y proximidad describen el registro de la fuente; no implican por sí solas daños
            ni constituyen una alerta oficial.
          </p>
        </div>
        <div className="event-detail-hero__actions">
          <Button
            variant={isFavorite ? 'primary' : 'secondary'}
            aria-pressed={isFavorite}
            disabled={favoriteStatus === 'checking' || savingFavorite}
            onClick={() => void toggleFavorite()}
          >
            {isFavorite ? (
              <BookmarkCheck size={15} aria-hidden="true" />
            ) : (
              <BookmarkPlus size={15} aria-hidden="true" />
            )}
            {savingFavorite
              ? 'Guardando…'
              : isFavorite
                ? 'Quitar de favoritos'
                : 'Guardar en favoritos'}
          </Button>
          <Button onClick={() => void copyCoordinates()}>
            <Clipboard size={15} aria-hidden="true" /> Copiar coordenadas
          </Button>
          <Button onClick={exportDetail}>
            <Download size={15} aria-hidden="true" /> Descargar JSON
          </Button>
        </div>
      </header>

      {event.reviewStatus === 'deleted' ? (
        <section className="detail-warning" role="status">
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong>USGS marca este evento como eliminado.</strong>
            <p>La ficha se conserva sólo con la información todavía disponible en la respuesta.</p>
          </div>
        </section>
      ) : null}
      {missingTechnicalFields >= 3 ? (
        <section className="detail-warning" role="status">
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong>Registro con información técnica limitada.</strong>
            <p>Los campos ausentes se muestran como no disponibles y no se sustituyen por cero.</p>
          </div>
        </section>
      ) : null}

      <div className="event-detail-layout">
        <main className="event-detail-main">
          <section className="panel event-core-data" aria-labelledby="core-data-title">
            <div className="panel__header">
              <div>
                <h2 id="core-data-title">Evento y localización</h2>
                <p>Instantes conservados en UTC; la zona local sólo cambia su presentación.</p>
              </div>
              <MapPinned size={18} aria-hidden="true" />
            </div>
            <dl className="detail-data-grid">
              <DetailDatum label="Fecha y hora UTC">
                <time dateTime={event.occurredAt}>
                  {formatDateTime(event.occurredAt, 'utc', 'long')}
                </time>
              </DetailDatum>
              <DetailDatum label="Fecha y hora local">
                <time dateTime={event.occurredAt}>
                  {formatDateTime(event.occurredAt, 'local', 'long')}
                </time>
              </DetailDatum>
              <DetailDatum label="Vista preferida">
                {preferredTimeZone === 'utc' ? 'UTC' : 'Zona local'}
              </DetailDatum>
              <DetailDatum label="Última revisión">
                <time dateTime={event.updatedAt}>{formatDateTime(event.updatedAt, 'utc')}</time>
              </DetailDatum>
              <DetailDatum label="Coordenadas" mono>
                {formatCoordinates(event.coordinates.latitude, event.coordinates.longitude)}
              </DetailDatum>
              <DetailDatum label="Coordenadas decimales" mono>
                {event.coordinates.latitude.toFixed(5)}, {event.coordinates.longitude.toFixed(5)}
              </DetailDatum>
              <DetailDatum label="Profundidad">
                {formatNumber(event.coordinates.depthKm, ' km')}
              </DetailDatum>
              <DetailDatum label="Red de origen">
                {event.sourceNetwork || 'No disponible'}
              </DetailDatum>
              <DetailDatum label="Estado">{reviewStatusLabel(event.reviewStatus)}</DetailDatum>
              <DetailDatum label="ID USGS" mono>
                {event.id}
              </DetailDatum>
            </dl>
          </section>

          <section className="panel detail-map-panel" aria-labelledby="detail-map-title">
            <div className="panel__header">
              <div>
                <h2 id="detail-map-title">Ubicación del epicentro</h2>
                <p>La marca también se describe en la ficha textual anterior.</p>
              </div>
            </div>
            <Suspense fallback={<div className="skeleton detail-map-fallback" />}>
              <EarthquakeMap events={[event]} selectedId={event.id} region="world" height={390} />
            </Suspense>
          </section>
        </main>

        <aside className="event-detail-sidebar" aria-label="Indicadores técnicos">
          <section className="panel detail-indicators" aria-labelledby="indicators-title">
            <div className="panel__header">
              <h2 id="indicators-title">Indicadores de fuente</h2>
              <Gauge size={18} aria-hidden="true" />
            </div>
            <dl>
              <DetailDatum label="Significancia USGS">
                {formatInteger(event.significance)}
              </DetailDatum>
              <DetailDatum label="Reportes de percepción">
                <span className="datum-with-icon">
                  <MessageCircle size={13} aria-hidden="true" /> {formatInteger(event.feltReports)}
                </span>
              </DetailDatum>
              <DetailDatum label="CDI — intensidad comunitaria">
                {formatNumber(detail.communityIntensity)}
              </DetailDatum>
              <DetailDatum label="MMI — intensidad instrumental">
                {formatNumber(detail.instrumentalIntensity)}
              </DetailDatum>
              <DetailDatum label="Alerta PAGER">
                {event.alertLevel ? event.alertLevel.toUpperCase() : 'No disponible'}
              </DetailDatum>
              <DetailDatum label="Indicador de tsunami">
                <span className="datum-with-icon">
                  <Waves size={13} aria-hidden="true" />{' '}
                  {event.tsunamiFlag ? 'Sí, reportado por la fuente' : 'No marcado por la fuente'}
                </span>
              </DetailDatum>
            </dl>
          </section>

          <section className="panel detail-quality" aria-labelledby="quality-title">
            <div className="panel__header">
              <h2 id="quality-title">Calidad del registro</h2>
              <Radio size={18} aria-hidden="true" />
            </div>
            <dl>
              <DetailDatum label="Estaciones utilizadas">
                {formatInteger(event.quality.stationCount)}
              </DetailDatum>
              <DetailDatum label="RMS">{formatNumber(event.quality.rms, ' s')}</DetailDatum>
              <DetailDatum label="Gap azimutal">
                {formatNumber(event.quality.azimuthalGap, '°')}
              </DetailDatum>
              <DetailDatum label="Distancia mínima">
                {formatNumber(event.quality.minimumDistance, '°')}
              </DetailDatum>
            </dl>
            <p>
              Estos campos se reportan por separado; SismoScope no los combina en una puntuación de
              confianza propia.
            </p>
          </section>

          <section className="panel detail-source" aria-labelledby="source-title">
            <div className="panel__header">
              <h2 id="source-title">Fuente y trazabilidad</h2>
              <ShieldCheck size={18} aria-hidden="true" />
            </div>
            <div className="detail-source__body">
              <p>Datos informativos procedentes de USGS Earthquake Hazards Program.</p>
              <a href={event.webUrl} target="_blank" rel="noopener noreferrer">
                Abrir ficha original de USGS <ExternalLink size={13} aria-hidden="true" />
              </a>
              <a href={detail.originalUrl} target="_blank" rel="noopener noreferrer">
                Abrir respuesta GeoJSON validada <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
          </section>
        </aside>
      </div>

      <ProductSection detail={detail} />
      <NearbyEventsSection anchor={event} />
    </div>
  );
}
