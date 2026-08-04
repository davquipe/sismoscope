import type { EChartsOption } from 'echarts';
import { AlertTriangle, ArrowDownRight, ArrowRightLeft, ArrowUpRight, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  calculateEarthquakeStatistics,
  createMagnitudeBuckets,
  type EarthquakeSearchQuery,
} from '@/entities/earthquake';
import { REGION_PRESETS } from '@/entities/region/regions';
import { useEarthquakeSearch } from '@/features/search-earthquakes/queries';
import { formatInteger, formatNumber } from '@/shared/lib/format';
import { AsyncChart } from '@/shared/ui/AsyncChart';
import { Badge } from '@/shared/ui/Badge';
import { StatePanel } from '@/shared/ui/StatePanel';

type CompareMode = 'regions' | 'periods';

function percentDifference(current: number, baseline: number): number | null {
  return baseline === 0 ? null : ((current - baseline) / baseline) * 100;
}

function regionQuery(
  region: 'peru' | 'world',
  startTime: string,
  endTime: string,
): EarthquakeSearchQuery {
  const bounds = REGION_PRESETS[region].bounds;
  return {
    startTime,
    endTime,
    ...(bounds ? { geographic: { type: 'rectangle' as const, bounds } } : {}),
    orderBy: 'time',
    limit: 5_000,
    offset: 1,
  };
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="comparison-delta">No calculado</span>;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`comparison-delta comparison-delta--${value >= 0 ? 'up' : 'down'}`}>
      <Icon size={14} aria-hidden="true" /> {value >= 0 ? '+' : ''}
      {formatNumber(value)} %
    </span>
  );
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const mode: CompareMode = params.get('mode') === 'periods' ? 'periods' : 'regions';
  const [referenceTime] = useState(() => Date.now());
  const day = 24 * 60 * 60_000;
  const currentStart = new Date(referenceTime - 7 * day).toISOString();
  const currentEnd = new Date(referenceTime).toISOString();
  const previousStart = new Date(referenceTime - 14 * day).toISOString();
  const previousEnd = currentStart;
  const queryA = useMemo(
    () => regionQuery('peru', currentStart, currentEnd),
    [currentEnd, currentStart],
  );
  const queryB = useMemo(
    () =>
      mode === 'regions'
        ? regionQuery('world', currentStart, currentEnd)
        : regionQuery('peru', previousStart, previousEnd),
    [currentEnd, currentStart, mode, previousEnd, previousStart],
  );
  const datasetA = useEarthquakeSearch(queryA);
  const datasetB = useEarthquakeSearch(queryB);
  const eventsA = useMemo(
    () => datasetA.resultsQuery.data?.events ?? [],
    [datasetA.resultsQuery.data?.events],
  );
  const eventsB = useMemo(
    () => datasetB.resultsQuery.data?.events ?? [],
    [datasetB.resultsQuery.data?.events],
  );
  const statsA = useMemo(() => calculateEarthquakeStatistics(eventsA), [eventsA]);
  const statsB = useMemo(() => calculateEarthquakeStatistics(eventsB), [eventsB]);
  const labelA = mode === 'regions' ? 'Perú · 7 días' : 'Perú · últimos 7 días';
  const labelB = mode === 'regions' ? 'Mundo · 7 días' : 'Perú · 7 días anteriores';
  const countsDifferGreatly =
    statsA.total > 0 &&
    statsB.total > 0 &&
    Math.max(statsA.total, statsB.total) / Math.min(statsA.total, statsB.total) > 3;
  const smallSample = statsA.total < 30 || statsB.total < 30;

  const distributionOption = useMemo<EChartsOption>(() => {
    const a = createMagnitudeBuckets(eventsA.map((event) => event.magnitude));
    const b = createMagnitudeBuckets(eventsB.map((event) => event.magnitude));
    return {
      color: ['#126f68', '#d76045'],
      legend: { data: [labelA, labelB], bottom: 0 },
      grid: { left: 40, right: 20, top: 25, bottom: 65 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['<1', '1–2.4', '2.5–3.9', '4–5.9', '6+'] },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          type: 'bar',
          name: labelA,
          data: a.buckets.map((bucket) => bucket.count),
          barMaxWidth: 30,
        },
        {
          type: 'bar',
          name: labelB,
          data: b.buckets.map((bucket) => bucket.count),
          barMaxWidth: 30,
        },
      ],
    };
  }, [eventsA, eventsB, labelA, labelB]);

  const loading =
    datasetA.countQuery.isPending ||
    datasetB.countQuery.isPending ||
    datasetA.resultsQuery.isPending ||
    datasetB.resultsQuery.isPending;
  const error =
    datasetA.countQuery.isError ||
    datasetB.countQuery.isError ||
    datasetA.resultsQuery.isError ||
    datasetB.resultsQuery.isError;
  const ready =
    !loading &&
    !error &&
    (datasetA.countQuery.data === 0 || eventsA.length > 0) &&
    (datasetB.countQuery.data === 0 || eventsB.length > 0);

  return (
    <div className="page compare-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">CONTRASTE DE DATASETS</p>
          <h1>Comparador</h1>
          <p>
            Dos consultas reales, con filtros y tamaños de muestra visibles. Las diferencias son
            descriptivas, no causales.
          </p>
        </div>
        <div className="segmented-control" aria-label="Tipo de comparación">
          <button type="button" aria-pressed={mode === 'regions'} onClick={() => setParams({})}>
            Perú / Mundo
          </button>
          <button
            type="button"
            aria-pressed={mode === 'periods'}
            onClick={() => setParams({ mode: 'periods' })}
          >
            Antes / Después
          </button>
        </div>
      </header>

      <section className="comparison-datasets" aria-label="Datasets comparados">
        <article>
          <Badge tone="teal">DATASET A</Badge>
          <h2>{labelA}</h2>
          <p>
            {currentStart.slice(0, 10)} → {currentEnd.slice(0, 10)}
          </p>
          <strong>{formatInteger(datasetA.countQuery.data)} eventos encontrados</strong>
          <small>{eventsA.length} cargados para comparar</small>
        </article>
        <span className="comparison-datasets__versus">
          <ArrowRightLeft aria-hidden="true" />
          <small>VS.</small>
        </span>
        <article>
          <Badge tone="critical">DATASET B</Badge>
          <h2>{labelB}</h2>
          <p>
            {mode === 'regions'
              ? `${currentStart.slice(0, 10)} → ${currentEnd.slice(0, 10)}`
              : `${previousStart.slice(0, 10)} → ${previousEnd.slice(0, 10)}`}
          </p>
          <strong>{formatInteger(datasetB.countQuery.data)} eventos encontrados</strong>
          <small>{eventsB.length} cargados para comparar</small>
        </article>
      </section>

      {loading ? (
        <div className="results-loading" aria-live="polite">
          <span className="route-loading__pulse" /> Contando y cargando ambos conjuntos…
        </div>
      ) : null}
      {error ? (
        <StatePanel
          type="error"
          title="No se pudo completar la comparación"
          description="Uno de los datasets no superó el conteo, la descarga o la validación. Ninguna métrica parcial se presenta como completa."
        />
      ) : null}

      {ready ? (
        <>
          {countsDifferGreatly || smallSample ? (
            <aside className="comparison-warning">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>Interpreta con cautela</strong>
                <p>
                  {smallSample ? 'Al menos una muestra tiene menos de 30 observaciones. ' : ''}
                  {countsDifferGreatly
                    ? 'Los tamaños de las muestras difieren en más de 3 veces. '
                    : ''}
                  Compara proporciones y calidad además de valores absolutos.
                </p>
              </div>
            </aside>
          ) : null}
          <section className="comparison-metrics" aria-label="Diferencias principales">
            <article>
              <span>Eventos cargados</span>
              <div>
                <strong>{formatInteger(statsA.total)}</strong>
                <i /> <strong>{formatInteger(statsB.total)}</strong>
              </div>
              <Delta value={percentDifference(statsA.total, statsB.total)} />
            </article>
            <article>
              <span>Magnitud máxima</span>
              <div>
                <strong>{formatNumber(statsA.maximumMagnitude)}</strong>
                <i /> <strong>{formatNumber(statsB.maximumMagnitude)}</strong>
              </div>
              <Delta
                value={
                  statsA.maximumMagnitude !== null && statsB.maximumMagnitude !== null
                    ? percentDifference(statsA.maximumMagnitude, statsB.maximumMagnitude)
                    : null
                }
              />
            </article>
            <article>
              <span>Profundidad media</span>
              <div>
                <strong>{formatNumber(statsA.averageDepthKm, ' km')}</strong>
                <i /> <strong>{formatNumber(statsB.averageDepthKm, ' km')}</strong>
              </div>
              <Delta
                value={
                  statsA.averageDepthKm !== null && statsB.averageDepthKm !== null
                    ? percentDifference(statsA.averageDepthKm, statsB.averageDepthKm)
                    : null
                }
              />
            </article>
            <article>
              <span>Registros revisados</span>
              <div>
                <strong>
                  {statsA.reviewedPercentage === null
                    ? '—'
                    : `${formatNumber(statsA.reviewedPercentage)} %`}
                </strong>
                <i />{' '}
                <strong>
                  {statsB.reviewedPercentage === null
                    ? '—'
                    : `${formatNumber(statsB.reviewedPercentage)} %`}
                </strong>
              </div>
              <Delta
                value={
                  statsA.reviewedPercentage !== null && statsB.reviewedPercentage !== null
                    ? percentDifference(statsA.reviewedPercentage, statsB.reviewedPercentage)
                    : null
                }
              />
            </article>
          </section>
          <section className="panel comparison-chart">
            <div className="panel__header">
              <div>
                <h2>
                  <Scale size={16} aria-hidden="true" /> Distribuciones superpuestas
                </h2>
                <p>Frecuencia por intervalo de magnitud; valores ausentes excluidos</p>
              </div>
            </div>
            <div className="panel__body">
              <AsyncChart
                option={distributionOption}
                height={340}
                ariaLabel={`Comparación de distribuciones de magnitud entre ${labelA} y ${labelB}.`}
              />
            </div>
          </section>
          <section className="comparison-quality">
            <h2>Calidad y composición de la muestra</h2>
            <div>
              <article>
                <Badge tone="teal">A</Badge>
                <dl>
                  <div>
                    <dt>Magnitudes ausentes</dt>
                    <dd>{statsA.magnitudes.missingCount}</dd>
                  </div>
                  <div>
                    <dt>Profundidades ausentes</dt>
                    <dd>{statsA.depthsKm.missingCount}</dd>
                  </div>
                  <div>
                    <dt>Con reportes</dt>
                    <dd>
                      {statsA.withFeltReportsPercentage === null
                        ? '—'
                        : `${formatNumber(statsA.withFeltReportsPercentage)} %`}
                    </dd>
                  </div>
                </dl>
              </article>
              <article>
                <Badge tone="critical">B</Badge>
                <dl>
                  <div>
                    <dt>Magnitudes ausentes</dt>
                    <dd>{statsB.magnitudes.missingCount}</dd>
                  </div>
                  <div>
                    <dt>Profundidades ausentes</dt>
                    <dd>{statsB.depthsKm.missingCount}</dd>
                  </div>
                  <div>
                    <dt>Con reportes</dt>
                    <dd>
                      {statsB.withFeltReportsPercentage === null
                        ? '—'
                        : `${formatNumber(statsB.withFeltReportsPercentage)} %`}
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
