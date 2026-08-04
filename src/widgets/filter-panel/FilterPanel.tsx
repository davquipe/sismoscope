import { ChevronDown, Filter, RotateCcw, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { REGION_PRESET_LIST } from '@/entities/region/regions';
import type { ExplorerFilters } from '@/features/search-earthquakes/url-state';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';

interface FilterFormValues {
  timeWindow: ExplorerFilters['timeWindow'];
  startTime: string;
  endTime: string;
  region: ExplorerFilters['region'];
  minMagnitude: string;
  maxMagnitude: string;
  minDepthKm: string;
  maxDepthKm: string;
  circleLatitude: string;
  circleLongitude: string;
  circleRadiusKm: string;
  minFelt: string;
  minSignificance: string;
  alertLevel: ExplorerFilters['alertLevel'];
  reviewStatus: ExplorerFilters['reviewStatus'];
  orderBy: ExplorerFilters['orderBy'];
}

interface FilterPanelProps {
  filters: ExplorerFilters;
  onApply: (filters: ExplorerFilters) => void;
  onClear: () => void;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toForm(filters: ExplorerFilters): FilterFormValues {
  return {
    timeWindow: filters.timeWindow,
    startTime: isoToLocalInput(filters.startTime),
    endTime: isoToLocalInput(filters.endTime),
    region: filters.region,
    minMagnitude: filters.minMagnitude?.toString() ?? '',
    maxMagnitude: filters.maxMagnitude?.toString() ?? '',
    minDepthKm: filters.minDepthKm?.toString() ?? '',
    maxDepthKm: filters.maxDepthKm?.toString() ?? '',
    circleLatitude:
      filters.geographicOverride?.type === 'circle'
        ? filters.geographicOverride.center.latitude.toString()
        : '',
    circleLongitude:
      filters.geographicOverride?.type === 'circle'
        ? filters.geographicOverride.center.longitude.toString()
        : '',
    circleRadiusKm:
      filters.geographicOverride?.type === 'circle'
        ? filters.geographicOverride.radiusKm.toString()
        : '',
    minFelt: filters.minFelt?.toString() ?? '',
    minSignificance: filters.minSignificance?.toString() ?? '',
    alertLevel: filters.alertLevel,
    reviewStatus: filters.reviewStatus,
    orderBy: filters.orderBy,
  };
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function FilterPanel({ filters, onApply, onClear }: FilterPanelProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FilterFormValues>({ defaultValues: toForm(filters) });
  const timeWindow = useWatch({ control, name: 'timeWindow' });

  useEffect(() => reset(toForm(filters)), [filters, reset]);

  const submit = handleSubmit((values) => {
    const minMagnitude = optionalNumber(values.minMagnitude);
    const maxMagnitude = optionalNumber(values.maxMagnitude);
    const minDepthKm = optionalNumber(values.minDepthKm);
    const maxDepthKm = optionalNumber(values.maxDepthKm);
    const circleLatitude = optionalNumber(values.circleLatitude);
    const circleLongitude = optionalNumber(values.circleLongitude);
    const circleRadiusKm = optionalNumber(values.circleRadiusKm);
    const hasCircleInput = [
      values.circleLatitude,
      values.circleLongitude,
      values.circleRadiusKm,
    ].some((value) => value.trim() !== '');
    if (minMagnitude !== null && maxMagnitude !== null && minMagnitude > maxMagnitude) {
      setError('maxMagnitude', { message: 'Debe ser igual o mayor que la mínima.' });
      return;
    }
    if (minDepthKm !== null && maxDepthKm !== null && minDepthKm > maxDepthKm) {
      setError('maxDepthKm', { message: 'Debe ser igual o mayor que la mínima.' });
      return;
    }
    if (values.timeWindow === 'custom' && (!values.startTime || !values.endTime)) {
      setError('endTime', { message: 'El rango personalizado requiere inicio y fin.' });
      return;
    }
    if (
      hasCircleInput &&
      (circleLatitude === null || circleLongitude === null || circleRadiusKm === null)
    ) {
      setError('circleRadiusKm', { message: 'Completa latitud, longitud y radio.' });
      return;
    }
    if (circleLatitude !== null && (circleLatitude < -90 || circleLatitude > 90)) {
      setError('circleLatitude', { message: 'Usa un valor entre −90 y 90.' });
      return;
    }
    if (circleLongitude !== null && (circleLongitude < -180 || circleLongitude > 180)) {
      setError('circleLongitude', { message: 'Usa un valor entre −180 y 180.' });
      return;
    }
    if (circleRadiusKm !== null && (circleRadiusKm <= 0 || circleRadiusKm > 20_001.6)) {
      setError('circleRadiusKm', { message: 'Usa un radio entre 0 y 20 001,6 km.' });
      return;
    }

    const geographicOverride = hasCircleInput
      ? {
          type: 'circle' as const,
          center: { latitude: circleLatitude ?? 0, longitude: circleLongitude ?? 0 },
          radiusKm: circleRadiusKm ?? 0,
        }
      : filters.geographicOverride?.type === 'rectangle' && values.region === filters.region
        ? filters.geographicOverride
        : null;

    onApply({
      ...filters,
      timeWindow: values.timeWindow,
      startTime: values.timeWindow === 'custom' ? new Date(values.startTime).toISOString() : null,
      endTime: values.timeWindow === 'custom' ? new Date(values.endTime).toISOString() : null,
      region: values.region,
      geographicOverride,
      minMagnitude,
      maxMagnitude,
      minDepthKm,
      maxDepthKm,
      minFelt: optionalNumber(values.minFelt),
      minSignificance: optionalNumber(values.minSignificance),
      alertLevel: values.alertLevel,
      reviewStatus: values.reviewStatus,
      orderBy: values.orderBy,
      page: 1,
    });
  });

  return (
    <form className="filter-panel" onSubmit={submit} noValidate>
      <div className="filter-panel__title">
        <span>
          <Filter size={16} aria-hidden="true" /> Filtros de consulta
        </span>
        <button type="button" onClick={onClear}>
          <RotateCcw size={13} aria-hidden="true" /> Limpiar
        </button>
      </div>

      <fieldset className="filter-group">
        <legend>Rango temporal</legend>
        <div className="time-presets">
          {(
            [
              ['hour', '1 h'],
              ['day', '24 h'],
              ['week', '7 días'],
              ['month', '30 días'],
              ['custom', 'Personalizado'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input type="radio" value={value} {...register('timeWindow')} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {timeWindow === 'custom' ? (
          <div className="filter-grid filter-grid--one">
            <div className="field">
              <label htmlFor="startTime">Desde</label>
              <input
                id="startTime"
                className="input"
                type="datetime-local"
                {...register('startTime')}
              />
            </div>
            <div className="field">
              <label htmlFor="endTime">Hasta</label>
              <input
                id="endTime"
                className="input"
                type="datetime-local"
                aria-describedby={errors.endTime ? 'endTime-error' : undefined}
                {...register('endTime')}
              />
              {errors.endTime ? (
                <span id="endTime-error" className="field-error">
                  {errors.endTime.message}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Región</legend>
        <div className="field">
          <label htmlFor="region">Preset geográfico</label>
          <select id="region" className="select" {...register('region')}>
            {REGION_PRESET_LIST.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
                {preset.approximate ? ' (aprox.)' : ''}
              </option>
            ))}
          </select>
          {filters.geographicOverride ? (
            <span className="field-hint">
              {filters.geographicOverride.type === 'rectangle'
                ? 'La vista actual del mapa reemplaza temporalmente este preset.'
                : `El radio de ${formatNumber(filters.geographicOverride.radiusKm)} km reemplaza temporalmente este preset.`}
            </span>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Magnitud y profundidad</legend>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="minMagnitude">Magnitud mín.</label>
            <input
              id="minMagnitude"
              className="input"
              type="number"
              step="0.1"
              min="-10"
              max="12"
              placeholder="Sin límite"
              {...register('minMagnitude')}
            />
          </div>
          <div className="field">
            <label htmlFor="maxMagnitude">Magnitud máx.</label>
            <input
              id="maxMagnitude"
              className="input"
              type="number"
              step="0.1"
              min="-10"
              max="12"
              placeholder="Sin límite"
              aria-describedby={errors.maxMagnitude ? 'maxMag-error' : undefined}
              {...register('maxMagnitude')}
            />
            {errors.maxMagnitude ? (
              <span id="maxMag-error" className="field-error">
                {errors.maxMagnitude.message}
              </span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="minDepth">Prof. mín. (km)</label>
            <input
              id="minDepth"
              className="input"
              type="number"
              step="1"
              placeholder="Sin límite"
              {...register('minDepthKm')}
            />
          </div>
          <div className="field">
            <label htmlFor="maxDepth">Prof. máx. (km)</label>
            <input
              id="maxDepth"
              className="input"
              type="number"
              step="1"
              placeholder="Sin límite"
              aria-describedby={errors.maxDepthKm ? 'maxDepth-error' : undefined}
              {...register('maxDepthKm')}
            />
            {errors.maxDepthKm ? (
              <span id="maxDepth-error" className="field-error">
                {errors.maxDepthKm.message}
              </span>
            ) : null}
          </div>
        </div>
      </fieldset>

      <details className="filter-advanced">
        <summary>
          <ChevronDown size={14} aria-hidden="true" /> Criterios avanzados
        </summary>
        <div className="filter-grid filter-advanced__body">
          <div className="filter-grid__wide circle-filter-heading">
            <strong>Radio desde un punto</strong>
            <span>Completa los tres campos o déjalos vacíos para usar la región.</span>
          </div>
          <div className="field">
            <label htmlFor="circleLatitude">Latitud</label>
            <input
              id="circleLatitude"
              className="input"
              type="number"
              min="-90"
              max="90"
              step="0.0001"
              placeholder="−12.0464"
              {...register('circleLatitude')}
            />
            {errors.circleLatitude ? (
              <span className="field-error">{errors.circleLatitude.message}</span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="circleLongitude">Longitud</label>
            <input
              id="circleLongitude"
              className="input"
              type="number"
              min="-180"
              max="180"
              step="0.0001"
              placeholder="−77.0428"
              {...register('circleLongitude')}
            />
            {errors.circleLongitude ? (
              <span className="field-error">{errors.circleLongitude.message}</span>
            ) : null}
          </div>
          <div className="field filter-grid__wide">
            <label htmlFor="circleRadiusKm">Radio (km)</label>
            <input
              id="circleRadiusKm"
              className="input"
              type="number"
              min="0.1"
              max="20001.6"
              step="0.1"
              placeholder="Ej. 250"
              {...register('circleRadiusKm')}
            />
            {errors.circleRadiusKm ? (
              <span className="field-error">{errors.circleRadiusKm.message}</span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="minFelt">Reportes mínimos</label>
            <input
              id="minFelt"
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="Cualquiera"
              {...register('minFelt')}
            />
          </div>
          <div className="field">
            <label htmlFor="minSignificance">Significancia mín.</label>
            <input
              id="minSignificance"
              className="input"
              type="number"
              min="0"
              step="1"
              placeholder="Cualquiera"
              {...register('minSignificance')}
            />
          </div>
          <div className="field">
            <label htmlFor="alert">Alerta PAGER</label>
            <select id="alert" className="select" {...register('alertLevel')}>
              <option value="all">Todas</option>
              <option value="green">Verde</option>
              <option value="yellow">Amarilla</option>
              <option value="orange">Naranja</option>
              <option value="red">Roja</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="review">Revisión</label>
            <select id="review" className="select" {...register('reviewStatus')}>
              <option value="all">Todos</option>
              <option value="reviewed">Revisados</option>
              <option value="automatic">Automáticos</option>
            </select>
          </div>
          <div className="field filter-grid__wide">
            <label htmlFor="order">Orden</label>
            <select id="order" className="select" {...register('orderBy')}>
              <option value="time">Más recientes</option>
              <option value="time-asc">Más antiguos</option>
              <option value="magnitude">Mayor magnitud</option>
              <option value="magnitude-asc">Menor magnitud</option>
            </select>
          </div>
        </div>
      </details>

      <Button type="submit" variant="primary" className="filter-panel__submit">
        <Search size={15} aria-hidden="true" /> Consultar USGS
      </Button>
    </form>
  );
}
