import type { EChartsOption } from 'echarts';
import { Download, FlaskConical, RefreshCw, Sigma, TableProperties } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  buildEarthquakeExportFilename,
  exportEarthquakesToCsv,
  type DescriptiveStatistics,
  type EarthquakeEvent,
  type TimeGranularity,
} from '@/entities/earthquake';
import { REGION_PRESETS } from '@/entities/region/regions';
import { useWorkerAnalytics } from '@/features/analyze-earthquakes/useWorkerAnalytics';
import { useRealtimeFeed } from '@/features/search-earthquakes/queries';
import { formatInteger, formatNumber } from '@/shared/lib/format';
import { AsyncChart } from '@/shared/ui/AsyncChart';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { StatePanel } from '@/shared/ui/StatePanel';

type AnalyticsDataset = 'week' | 'month';
type AnalyticsRegion = 'peru' | 'world';

function eventsInRegion(events: readonly EarthquakeEvent[], region: AnalyticsRegion) {
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

function downloadCsv(events: readonly EarthquakeEvent[], description: string) {
  const generatedAt = new Date().toISOString();
  const content = exportEarthquakesToCsv(events, { generatedAt, queryDescription: description });
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = buildEarthquakeExportFilename('csv', generatedAt);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const dataset: AnalyticsDataset = params.get('dataset') === 'month' ? 'month' : 'week';
  const region: AnalyticsRegion = params.get('region') === 'world' ? 'world' : 'peru';
  const granularity: TimeGranularity =
    params.get('grain') === 'hour' ? 'hour' : params.get('grain') === 'week' ? 'week' : 'day';
  const feedQuery = useRealtimeFeed(dataset === 'month' ? 'all_month' : 'all_week');
  const events = useMemo(
    () => eventsInRegion(feedQuery.data?.events ?? [], region),
    [feedQuery.data?.events, region],
  );
  const analytics = useWorkerAnalytics(events, granularity);
  const result = analytics.result;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (
      (key === 'dataset' && value === 'week') ||
      (key === 'region' && value === 'peru') ||
      (key === 'grain' && value === 'day')
    )
      next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  const timelineOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 38, right: 18, top: 22, bottom: 55 },
      tooltip: { trigger: 'axis' },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 17, bottom: 5 }],
      xAxis: {
        type: 'category',
        data:
          result?.timeSeries.map((point) =>
            new Intl.DateTimeFormat('es-PE', {
              month: 'short',
              day: '2-digit',
              hour: granularity === 'hour' ? '2-digit' : undefined,
              timeZone: 'UTC',
            }).format(new Date(point.startAt)),
          ) ?? [],
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', minInterval: 1, name: 'Eventos' },
      series: [
        {
          type: 'line',
          smooth: 0.2,
          symbolSize: 5,
          data: result?.timeSeries.map((point) => point.count) ?? [],
          lineStyle: { color: '#126f68', width: 2 },
          itemStyle: { color: '#126f68' },
          areaStyle: { color: 'rgba(18,111,104,.09)' },
        },
      ],
    }),
    [granularity, result?.timeSeries],
  );

  const magnitudeOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 38, right: 15, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['<1', '1–2.4', '2.5–3.9', '4–5.9', '6+'] },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          type: 'bar',
          data: result?.magnitudeBuckets.buckets.map((bucket) => bucket.count) ?? [],
          barMaxWidth: 42,
          itemStyle: { color: '#386d93', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [result?.magnitudeBuckets.buckets],
  );

  const depthOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 38, right: 15, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['<0', '0–69', '70–299', '300+'] },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          type: 'bar',
          data: result?.depthBuckets.buckets.map((bucket) => bucket.count) ?? [],
          barMaxWidth: 42,
          itemStyle: { color: '#5d5a91', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [result?.depthBuckets.buckets],
  );

  const magnitudeDepthOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 50, right: 20, top: 20, bottom: 42 },
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', name: 'Magnitud', nameLocation: 'middle', nameGap: 28 },
      yAxis: { type: 'value', name: 'Prof. km', inverse: true },
      series: [
        {
          type: 'scatter',
          data: result?.magnitudeDepthScatter.map(([magnitude, depth]) => [magnitude, depth]) ?? [],
          symbolSize: 7,
          itemStyle: { color: '#bd7621', opacity: 0.66 },
        },
      ],
    }),
    [result?.magnitudeDepthScatter],
  );

  const timeMagnitudeOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 42, right: 20, top: 20, bottom: 48 },
      tooltip: { trigger: 'item' },
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: 'Magnitud' },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 17, bottom: 5 }],
      series: [
        {
          type: 'scatter',
          data: result?.timeMagnitudeScatter.map(([time, magnitude]) => [time, magnitude]) ?? [],
          symbolSize: 6,
          itemStyle: { color: '#d76045', opacity: 0.65 },
        },
      ],
    }),
    [result?.timeMagnitudeScatter],
  );

  const networkOption = useMemo<EChartsOption>(() => {
    const top = result?.networks.slice(0, 8) ?? [];
    return {
      grid: { left: 75, right: 20, top: 18, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: top.map((item) => item.label.toUpperCase()), inverse: true },
      series: [
        {
          type: 'bar',
          data: top.map((item) => item.count),
          itemStyle: { color: '#126f68' },
          barMaxWidth: 22,
        },
      ],
    };
  }, [result?.networks]);
  const statisticRows: readonly (readonly [string, DescriptiveStatistics])[] = result
    ? [
        ['Magnitud', result.statistics.magnitudes],
        ['Profundidad (km)', result.statistics.depthsKm],
      ]
    : [];

  return (
    <div className="page analytics-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">LABORATORIO DE DATOS</p>
          <h1>Analítica sísmica</h1>
          <p>
            Estadísticas descriptivas calculadas en tu navegador. Las asociaciones observadas no
            demuestran causalidad.
          </p>
        </div>
        <div className="page-actions">
          <Button
            disabled={!events.length}
            onClick={() => downloadCsv(events, `${dataset}-${region}`)}
          >
            <Download size={15} aria-hidden="true" /> Exportar dataset
          </Button>
          <Button onClick={() => void feedQuery.refetch()} disabled={feedQuery.isFetching}>
            <RefreshCw size={15} aria-hidden="true" /> Actualizar
          </Button>
        </div>
      </header>

      <section className="analytics-controls" aria-label="Dataset analizado">
        <div className="field">
          <label htmlFor="analytics-period">Periodo</label>
          <select
            id="analytics-period"
            className="select"
            value={dataset}
            onChange={(event) => updateParam('dataset', event.target.value)}
          >
            <option value="week">Últimos 7 días</option>
            <option value="month">Últimos 30 días</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="analytics-region">Región</label>
          <select
            id="analytics-region"
            className="select"
            value={region}
            onChange={(event) => updateParam('region', event.target.value)}
          >
            <option value="peru">Perú (aprox.)</option>
            <option value="world">Mundo</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="analytics-grain">Unidad temporal</label>
          <select
            id="analytics-grain"
            className="select"
            value={granularity}
            onChange={(event) => updateParam('grain', event.target.value)}
          >
            <option value="hour">Hora</option>
            <option value="day">Día</option>
            <option value="week">Semana</option>
          </select>
        </div>
        <div className="analytics-controls__status">
          <Badge tone="teal">WEB WORKER</Badge>
          <span>
            {analytics.status === 'loading'
              ? 'Calculando sin bloquear la interfaz…'
              : `${formatInteger(events.length)} observaciones`}
          </span>
        </div>
      </section>

      {feedQuery.isPending ? (
        <div className="results-loading" aria-live="polite">
          <span className="route-loading__pulse" /> Descargando dataset real de USGS…
        </div>
      ) : null}
      {feedQuery.isError ? (
        <StatePanel
          type="error"
          title="No pudimos descargar el dataset"
          description="La fuente no respondió o el contenido no pasó la validación. El análisis no continuará con datos incompletos."
          onRetry={() => void feedQuery.refetch()}
        />
      ) : null}
      {analytics.status === 'error' ? (
        <StatePanel
          type="error"
          title="El cálculo fue interrumpido"
          description={analytics.error}
        />
      ) : null}
      {feedQuery.data && events.length === 0 ? (
        <StatePanel
          type="empty"
          title="No hay observaciones en este dataset"
          description="Prueba la cobertura mundial o un periodo más amplio."
        />
      ) : null}

      {result ? (
        <>
          <section className="analytics-kpis" aria-label="Estadísticas principales">
            <article>
              <span>
                <Sigma size={15} aria-hidden="true" /> Muestra
              </span>
              <strong>{formatInteger(result.statistics.total)}</strong>
              <small>eventos validados</small>
            </article>
            <article>
              <span>Magnitud media</span>
              <strong>{formatNumber(result.statistics.magnitudes.mean)}</strong>
              <small>mediana {formatNumber(result.statistics.magnitudes.median)}</small>
            </article>
            <article>
              <span>Magnitud máxima</span>
              <strong>{formatNumber(result.statistics.maximumMagnitude)}</strong>
              <small>mín. {formatNumber(result.statistics.magnitudes.minimum)}</small>
            </article>
            <article>
              <span>Profundidad media</span>
              <strong>{formatNumber(result.statistics.averageDepthKm, ' km')}</strong>
              <small>mediana {formatNumber(result.statistics.medianDepthKm, ' km')}</small>
            </article>
            <article>
              <span>Revisados</span>
              <strong>
                {result.statistics.reviewedPercentage === null
                  ? 'No calculado'
                  : `${formatNumber(result.statistics.reviewedPercentage)} %`}
              </strong>
              <small>del dataset cargado</small>
            </article>
          </section>

          <div className="analytics-chart-grid">
            <section className="panel analytics-chart analytics-chart--wide">
              <div className="panel__header">
                <div>
                  <h2>Frecuencia temporal</h2>
                  <p>
                    Eventos por{' '}
                    {granularity === 'hour' ? 'hora' : granularity === 'day' ? 'día' : 'semana'} en
                    UTC
                  </p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={timelineOption}
                  height={290}
                  ariaLabel={`Serie temporal de ${result.statistics.total} eventos.`}
                />
                <details className="chart-alternative">
                  <summary>Alternativa textual</summary>
                  <p>
                    {result.timeSeries
                      .map((point) => `${point.startAt}: ${point.count}`)
                      .join('; ')}
                  </p>
                </details>
              </div>
            </section>
            <section className="panel analytics-chart">
              <div className="panel__header">
                <div>
                  <h2>Histograma de magnitud</h2>
                  <p>{result.magnitudeBuckets.missingCount} valores ausentes</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={magnitudeOption}
                  ariaLabel="Histograma de eventos por intervalo de magnitud."
                />
                <details className="chart-alternative">
                  <summary>Alternativa textual</summary>
                  <p>
                    {result.magnitudeBuckets.buckets
                      .map((bucket) => `${bucket.id}: ${bucket.count}`)
                      .join('; ')}
                    . Ausentes: {result.magnitudeBuckets.missingCount}.
                  </p>
                </details>
              </div>
            </section>
            <section className="panel analytics-chart">
              <div className="panel__header">
                <div>
                  <h2>Histograma de profundidad</h2>
                  <p>Superficial, intermedia y profunda</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={depthOption}
                  ariaLabel="Histograma de eventos por intervalo de profundidad."
                />
                <details className="chart-alternative">
                  <summary>Alternativa textual</summary>
                  <p>
                    {result.depthBuckets.buckets
                      .map((bucket) => `${bucket.id}: ${bucket.count}`)
                      .join('; ')}
                    . Ausentes: {result.depthBuckets.missingCount}.
                  </p>
                </details>
              </div>
            </section>
            <section className="panel analytics-chart">
              <div className="panel__header">
                <div>
                  <h2>Magnitud vs. profundidad</h2>
                  <p>Cada punto es una observación; profundidad crece hacia abajo</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={magnitudeDepthOption}
                  ariaLabel="Diagrama de dispersión de magnitud frente a profundidad."
                />
                <details className="chart-alternative">
                  <summary>Alternativa textual</summary>
                  <p>
                    {result.magnitudeDepthScatter.length} pares válidos. Magnitud entre{' '}
                    {formatNumber(result.statistics.magnitudes.minimum)} y{' '}
                    {formatNumber(result.statistics.magnitudes.maximum)}; profundidad entre{' '}
                    {formatNumber(result.statistics.depthsKm.minimum, ' km')} y{' '}
                    {formatNumber(result.statistics.depthsKm.maximum, ' km')}.
                  </p>
                </details>
              </div>
            </section>
            <section className="panel analytics-chart">
              <div className="panel__header">
                <div>
                  <h2>Tiempo vs. magnitud</h2>
                  <p>Zoom horizontal disponible</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={timeMagnitudeOption}
                  ariaLabel="Diagrama de dispersión temporal de magnitudes."
                />
                <details className="chart-alternative">
                  <summary>Alternativa textual</summary>
                  <p>
                    {result.timeMagnitudeScatter.length} eventos tienen simultáneamente fecha y
                    magnitud disponibles en el periodo seleccionado.
                  </p>
                </details>
              </div>
            </section>
            <section className="panel analytics-chart">
              <div className="panel__header">
                <div>
                  <h2>Redes de origen</h2>
                  <p>Ocho redes con más registros en la muestra</p>
                </div>
              </div>
              <div className="panel__body">
                <AsyncChart
                  option={networkOption}
                  ariaLabel="Distribución de eventos por red de origen."
                />
                <details className="chart-alternative">
                  <summary>Alternativa textual</summary>
                  <p>
                    {result.networks
                      .slice(0, 8)
                      .map((network) => `${network.label}: ${network.count}`)
                      .join('; ')}
                    .
                  </p>
                </details>
              </div>
            </section>
          </div>

          <section className="panel analytics-table-panel" aria-labelledby="stats-table-title">
            <div className="panel__header">
              <div>
                <h2 id="stats-table-title">
                  <TableProperties size={16} aria-hidden="true" /> Estadísticas descriptivas
                </h2>
                <p>Percentiles R-7; desviación estándar poblacional</p>
              </div>
              <Badge tone="blue">METODOLOGÍA TRANSPARENTE</Badge>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Variable</th>
                    <th scope="col">n válido</th>
                    <th scope="col">Ausentes</th>
                    <th scope="col">Media</th>
                    <th scope="col">Desv. estándar</th>
                    <th scope="col">Mínimo</th>
                    <th scope="col">P25</th>
                    <th scope="col">Mediana</th>
                    <th scope="col">P75</th>
                    <th scope="col">P95</th>
                    <th scope="col">Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {statisticRows.map(([label, stats]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{stats.count}</td>
                      <td>{stats.missingCount}</td>
                      <td>{formatNumber(stats.mean)}</td>
                      <td>{formatNumber(stats.standardDeviation)}</td>
                      <td>{formatNumber(stats.minimum)}</td>
                      <td>{formatNumber(stats.percentiles.p25)}</td>
                      <td>{formatNumber(stats.median)}</td>
                      <td>{formatNumber(stats.percentiles.p75)}</td>
                      <td>{formatNumber(stats.percentiles.p95)}</td>
                      <td>{formatNumber(stats.maximum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="methodology-note">
            <FlaskConical size={18} aria-hidden="true" />
            <div>
              <strong>Cómo leer estos resultados</strong>
              <p>
                Son resúmenes del conjunto cargado y dependen de cobertura, revisiones y campos
                disponibles en USGS. Ninguna correlación visual implica que una variable cause otra.
              </p>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
