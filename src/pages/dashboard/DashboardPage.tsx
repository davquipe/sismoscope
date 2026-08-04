import type { EChartsOption } from 'echarts';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Crosshair,
  Gauge,
  Maximize2,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePreferencesStore } from '@/app/store/preferences-store';
import {
  calculateEarthquakeStatistics,
  createDepthBuckets,
  createMagnitudeBuckets,
  groupEventsByUtcTime,
  type EarthquakeEvent,
} from '@/entities/earthquake';
import { REGION_PRESETS, type RegionPresetId } from '@/entities/region/regions';
import { useRealtimeFeed } from '@/features/search-earthquakes/queries';
import { formatDateTime, formatInteger, formatNumber } from '@/shared/lib/format';
import { AsyncChart } from '@/shared/ui/AsyncChart';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { StatePanel } from '@/shared/ui/StatePanel';
import { EventListItem } from '@/entities/earthquake/ui/EventListItem';

const EarthquakeMap = lazy(() => import('@/widgets/earthquake-map/EarthquakeMap'));

type DashboardRegion = Extract<RegionPresetId, 'peru' | 'world'>;

function withinRegion(events: readonly EarthquakeEvent[], region: DashboardRegion) {
  const bounds = REGION_PRESETS[region].bounds;
  if (!bounds) return events;
  return events.filter(
    ({ coordinates }) =>
      coordinates.latitude >= bounds.minLatitude &&
      coordinates.latitude <= bounds.maxLatitude &&
      coordinates.longitude >= bounds.minLongitude &&
      coordinates.longitude <= bounds.maxLongitude,
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article className={`dashboard-metric${accent ? ' dashboard-metric--accent' : ''}`}>
      <div className="dashboard-metric__label">
        <Icon size={15} aria-hidden="true" /> {label}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Cargando resumen sísmico" aria-busy="true">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}

export default function DashboardPage() {
  const initialRegion = usePreferencesStore((state) => state.preferences.initialRegion);
  const autoRefresh = usePreferencesStore((state) => state.preferences.autoRefresh);
  const [region, setRegion] = useState<DashboardRegion>(
    initialRegion === 'world' ? 'world' : 'peru',
  );
  const refreshMs = autoRefresh.enabled ? autoRefresh.intervalSeconds * 1000 : false;
  const dayQuery = useRealtimeFeed('all_day', refreshMs);
  const weekQuery = useRealtimeFeed('all_week');

  const dayEvents = useMemo(
    () => withinRegion(dayQuery.data?.events ?? [], region),
    [dayQuery.data?.events, region],
  );
  const weekEvents = useMemo(
    () => withinRegion(weekQuery.data?.events ?? [], region),
    [weekQuery.data?.events, region],
  );
  const dayStats = useMemo(() => calculateEarthquakeStatistics(dayEvents), [dayEvents]);
  const weekStats = useMemo(() => calculateEarthquakeStatistics(weekEvents), [weekEvents]);
  const highlighted = useMemo(
    () => [...dayEvents].sort((a, b) => (b.magnitude ?? -20) - (a.magnitude ?? -20)).slice(0, 6),
    [dayEvents],
  );

  const timelineOption = useMemo<EChartsOption>(() => {
    const points = groupEventsByUtcTime(weekEvents, 'day');
    return {
      animationDuration: 250,
      grid: { left: 34, right: 16, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', valueFormatter: (value) => `${String(value)} eventos` },
      xAxis: {
        type: 'category',
        data: points.map((point) =>
          new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'UTC' }).format(
            new Date(point.startAt),
          ),
        ),
        axisTick: { show: false },
      },
      yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#d9d7cf' } } },
      series: [
        {
          type: 'line',
          data: points.map((point) => point.count),
          smooth: 0.25,
          symbolSize: 7,
          lineStyle: { color: '#126f68', width: 2 },
          itemStyle: { color: '#126f68' },
          areaStyle: { color: 'rgba(18,111,104,.08)' },
        },
      ],
    };
  }, [weekEvents]);

  const magnitudeOption = useMemo<EChartsOption>(() => {
    const distribution = createMagnitudeBuckets(weekEvents.map((event) => event.magnitude));
    const labels: Record<string, string> = {
      'below-1': '< 1',
      '1-to-2.5': '1–2.4',
      '2.5-to-4': '2.5–3.9',
      '4-to-6': '4–5.9',
      '6-plus': '6+',
    };
    return {
      animationDuration: 250,
      grid: { left: 34, right: 16, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: distribution.buckets.map((bucket) => labels[bucket.id] ?? bucket.id),
        axisTick: { show: false },
      },
      yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#d9d7cf' } } },
      series: [
        {
          type: 'bar',
          data: distribution.buckets.map((bucket) => bucket.count),
          itemStyle: { color: '#386d93', borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 34,
        },
      ],
    };
  }, [weekEvents]);

  const depthOption = useMemo<EChartsOption>(() => {
    const distribution = createDepthBuckets(weekEvents.map((event) => event.coordinates.depthKm));
    return {
      animationDuration: 250,
      grid: { left: 34, right: 16, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: ['< 0', '0–69', '70–299', '300+'],
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#d9d7cf' } },
      },
      series: [
        {
          type: 'bar',
          data: distribution.buckets.map((bucket) => bucket.count),
          itemStyle: { color: '#5d5a91', borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 34,
        },
      ],
    };
  }, [weekEvents]);

  const refresh = () => {
    void Promise.all([dayQuery.refetch(), weekQuery.refetch()]);
  };

  return (
    <div className="page dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <p className="eyebrow">PANORAMA OPERATIVO</p>
          <h1>La Tierra, ahora.</h1>
          <p>
            Actividad registrada por USGS en{' '}
            {region === 'peru' ? 'el entorno del Perú' : 'todo el mundo'}, normalizada y resumida
            sin inferir daños ni causalidad.
          </p>
        </div>
        <div className="dashboard-header__controls">
          <div className="segmented-control" aria-label="Cobertura geográfica">
            <button
              type="button"
              aria-pressed={region === 'peru'}
              onClick={() => setRegion('peru')}
            >
              Perú
            </button>
            <button
              type="button"
              aria-pressed={region === 'world'}
              onClick={() => setRegion('world')}
            >
              Mundo
            </button>
          </div>
          <Button onClick={refresh} disabled={dayQuery.isFetching || weekQuery.isFetching}>
            <RefreshCw size={14} aria-hidden="true" />
            {dayQuery.isFetching ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>
      </header>

      {dayQuery.isPending || weekQuery.isPending ? <DashboardSkeleton /> : null}
      {dayQuery.isError || weekQuery.isError ? (
        <StatePanel
          type={navigator.onLine ? 'error' : 'offline'}
          title="No pudimos obtener la actividad reciente"
          description="USGS no respondió o envió datos que no superaron la validación. Puedes volver a intentar sin perder tu configuración."
          onRetry={refresh}
        />
      ) : null}

      {dayQuery.data && weekQuery.data ? (
        <>
          <section className="activity-ledger" aria-labelledby="activity-title">
            <div className="activity-ledger__intro">
              <span className="activity-ledger__live">
                <i /> EN VIVO · 24 HORAS
              </span>
              <h2 id="activity-title">{formatInteger(dayStats.total)}</h2>
              <p>eventos registrados</p>
              <small>
                <Clock3 size={13} aria-hidden="true" /> Actualizado{' '}
                <time dateTime={dayQuery.data.metadata.generatedAt}>
                  {formatDateTime(dayQuery.data.metadata.generatedAt, 'local')}
                </time>
              </small>
            </div>
            <div className="activity-ledger__metrics">
              <Metric
                label="Magnitud máxima"
                value={formatNumber(dayStats.maximumMagnitude)}
                detail="Mayor valor reportado"
                icon={Gauge}
                accent
              />
              <Metric
                label="Profundidad media"
                value={formatNumber(dayStats.averageDepthKm, ' km')}
                detail={`Mediana ${formatNumber(dayStats.medianDepthKm, ' km')}`}
                icon={Crosshair}
              />
              <Metric
                label="Significativos"
                value={formatInteger(dayStats.significantCount)}
                detail="Significancia USGS ≥ 600"
                icon={ShieldAlert}
              />
              <Metric
                label="Con reportes"
                value={formatInteger(
                  dayEvents.filter((event) => (event.feltReports ?? 0) > 0).length,
                )}
                detail="Percepción ciudadana"
                icon={MessageCircle}
              />
            </div>
          </section>

          <section className="dashboard-week" aria-label="Resumen de siete días">
            <div>
              <CalendarDays size={17} aria-hidden="true" />
              <span>
                <strong>{formatInteger(weekStats.total)}</strong> eventos en 7 días
              </span>
            </div>
            <div>
              <strong>{formatNumber(weekStats.maximumMagnitude)}</strong> magnitud máxima
            </div>
            <div>
              <strong>{formatInteger(weekStats.withAlertCount)}</strong> con alerta PAGER
            </div>
            <Badge tone="teal">
              {REGION_PRESETS[region].approximate ? 'Zona aproximada' : 'Cobertura global'}
            </Badge>
          </section>

          <div className="dashboard-grid dashboard-grid--map">
            <section className="panel dashboard-map-panel" aria-labelledby="recent-map-title">
              <div className="panel__header">
                <div>
                  <h2 id="recent-map-title">Distribución reciente</h2>
                  <p>{dayEvents.length} eventos · color por profundidad</p>
                </div>
                <Link
                  className="button button--ghost"
                  to={`/explorer?${region === 'world' ? 'region=world&' : ''}view=map`}
                >
                  <Maximize2 size={14} aria-hidden="true" /> Explorar mapa
                </Link>
              </div>
              <Suspense fallback={<div className="skeleton dashboard-map-fallback" />}>
                <EarthquakeMap events={dayEvents} region={region} height={390} />
              </Suspense>
            </section>

            <section className="panel dashboard-events-panel" aria-labelledby="highlighted-title">
              <div className="panel__header">
                <div>
                  <h2 id="highlighted-title">Eventos destacados</h2>
                  <p>Ordenados por magnitud reportada</p>
                </div>
                <Badge>{highlighted.length}</Badge>
              </div>
              {highlighted.length ? (
                highlighted.map((event) => <EventListItem key={event.id} event={event} />)
              ) : (
                <StatePanel
                  type="empty"
                  title="Sin eventos para destacar"
                  description="No hay registros en esta zona durante las últimas 24 horas."
                />
              )}
            </section>
          </div>

          <div className="dashboard-grid dashboard-grid--charts">
            <section className="panel" aria-labelledby="timeline-title">
              <div className="panel__header">
                <div>
                  <h2 id="timeline-title">Ritmo de actividad</h2>
                  <p>Eventos por día · últimos 7 días · UTC</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={timelineOption}
                  ariaLabel={`Gráfico temporal de siete días con ${weekStats.total} eventos en total.`}
                />
                <details className="chart-alternative">
                  <summary>Ver alternativa textual</summary>
                  <p>
                    Se registraron {weekStats.total} eventos distribuidos en los últimos siete días.
                    Magnitud máxima: {formatNumber(weekStats.maximumMagnitude)}.
                  </p>
                </details>
              </div>
            </section>
            <section className="panel" aria-labelledby="magnitude-title">
              <div className="panel__header">
                <div>
                  <h2 id="magnitude-title">Distribución de magnitud</h2>
                  <p>Frecuencia por intervalos</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={magnitudeOption}
                  ariaLabel={`Histograma de magnitudes para ${weekStats.total} eventos.`}
                />
                <details className="chart-alternative">
                  <summary>Ver alternativa textual</summary>
                  <p>
                    Media {formatNumber(weekStats.magnitudes.mean)}, mediana{' '}
                    {formatNumber(weekStats.magnitudes.median)}; {weekStats.magnitudes.missingCount}{' '}
                    valores no disponibles.
                  </p>
                </details>
              </div>
            </section>
            <section className="panel" aria-labelledby="depth-title">
              <div className="panel__header">
                <div>
                  <h2 id="depth-title">Distribución de profundidad</h2>
                  <p>Frecuencia por intervalos · km</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={depthOption}
                  ariaLabel={`Histograma de profundidad para ${weekStats.total} eventos.`}
                />
                <details className="chart-alternative">
                  <summary>Ver alternativa textual</summary>
                  <p>
                    Media {formatNumber(weekStats.depthsKm.mean, ' km')}, mediana{' '}
                    {formatNumber(weekStats.depthsKm.median, ' km')};{' '}
                    {weekStats.depthsKm.missingCount} valores no disponibles.
                  </p>
                </details>
              </div>
            </section>
          </div>

          <div className="dashboard-cta">
            <div>
              <span className="eyebrow">PROFUNDIZA</span>
              <h2>Consulta el catálogo con tus propios criterios.</h2>
              <p>
                Filtra por tiempo, magnitud, profundidad y región. Toda descarga histórica comienza
                con un conteo de seguridad.
              </p>
            </div>
            <Link
              className="button button--primary"
              to={`/explorer?time=week${region === 'world' ? '&region=world' : ''}`}
            >
              Abrir explorador <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
