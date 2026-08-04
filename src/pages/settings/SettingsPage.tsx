import {
  Database,
  Gauge,
  Globe2,
  MonitorCog,
  Moon,
  RefreshCw,
  RotateCcw,
  Rows3,
  Sun,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  usePreferencesStore,
  type TableDensityPreference,
  type ThemePreference,
  type TimeZonePreference,
} from '@/app/store/preferences-store';
import { REGION_PRESET_LIST, type RegionPresetId } from '@/entities/region/regions';
import { sismoScopeDatabase } from '@/shared/persistence/database';
import type { AutoRefreshPreference } from '@/shared/persistence/schemas';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';

import './settings.css';

const AUTO_REFRESH_INTERVALS = [30, 60, 120, 300, 600] as const;
type AutoRefreshInterval = (typeof AUTO_REFRESH_INTERVALS)[number];

function parseAutoRefreshInterval(value: string): AutoRefreshInterval {
  const interval = Number(value);
  switch (interval) {
    case 30:
    case 60:
    case 120:
    case 300:
    case 600:
      return interval;
    default:
      return 60;
  }
}

function parseTimeZonePreference(value: string): TimeZonePreference {
  return value === 'utc' ? 'utc' : 'local';
}

function parsePageSize(value: string): 25 | 50 | 100 {
  if (value === '25') return 25;
  if (value === '50') return 50;
  return 100;
}

function parseRegionPreset(value: string): RegionPresetId {
  switch (value) {
    case 'peru':
    case 'peru-coast':
    case 'peru-highlands':
    case 'peru-amazon':
    case 'pacific-ring':
    case 'world':
      return value;
    default:
      return 'peru';
  }
}

function refreshIntervalLabel(seconds: AutoRefreshInterval): string {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = seconds / 60;
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

interface ChoiceButtonProps<Value extends string> {
  value: Value;
  selected: boolean;
  label: string;
  description: string;
  icon: typeof Sun;
  onSelect: (value: Value) => void;
}

function ChoiceButton<Value extends string>({
  value,
  selected,
  label,
  description,
  icon: Icon,
  onSelect,
}: ChoiceButtonProps<Value>) {
  return (
    <button
      type="button"
      className="settings-choice"
      aria-pressed={selected}
      onClick={() => onSelect(value)}
    >
      <Icon size={18} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const preferences = usePreferencesStore((state) => state.preferences);
  const [statusMessage, setStatusMessage] = useState('');
  const [clearError, setClearError] = useState('');
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const clearDialogRef = useRef<HTMLDialogElement>(null);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelClearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = clearDialogRef.current;
    if (dialog === null || !isClearDialogOpen || dialog.open) return;
    dialog.showModal();
    cancelClearRef.current?.focus();
  }, [isClearDialogOpen]);

  const updateTheme = (theme: ThemePreference) => {
    usePreferencesStore.getState().setTheme(theme);
    setStatusMessage('Tema actualizado.');
  };

  const updateTimeZone = (timeZone: TimeZonePreference) => {
    usePreferencesStore.getState().setTimeZone(timeZone);
    setStatusMessage('Zona horaria actualizada.');
  };

  const updateDensity = (density: TableDensityPreference) => {
    usePreferencesStore.getState().setTableDensity(density);
    setStatusMessage('Densidad de tabla actualizada.');
  };

  const updateAutoRefresh = (autoRefresh: AutoRefreshPreference) => {
    usePreferencesStore.getState().setAutoRefresh(autoRefresh);
    setStatusMessage(
      autoRefresh.enabled ? 'Autoactualización activada.' : 'Autoactualización desactivada.',
    );
  };

  const closeClearDialog = () => {
    const dialog = clearDialogRef.current;
    if (dialog?.open) dialog.close();
    setIsClearDialogOpen(false);
  };

  const confirmClearLocalData = async () => {
    setIsClearing(true);
    setClearError('');
    try {
      usePreferencesStore.getState().resetPreferences();
      await Promise.resolve(usePreferencesStore.persist.clearStorage());
      await sismoScopeDatabase.clearAll();
      await Promise.resolve(usePreferencesStore.persist.clearStorage());
      setStatusMessage('Se borraron las búsquedas, favoritos y preferencias locales.');
      closeClearDialog();
    } catch (error: unknown) {
      setClearError(
        error instanceof Error
          ? error.message
          : 'No se pudieron borrar por completo los datos locales.',
      );
    } finally {
      setIsClearing(false);
    }
  };

  const autoRefreshInterval = preferences.autoRefresh.enabled
    ? preferences.autoRefresh.intervalSeconds
    : 60;

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">PREFERENCIAS LOCALES</p>
          <h1>Configuración</h1>
          <p>
            Ajusta la presentación y el ritmo de actualización. Todo permanece en este navegador;
            SismoScope no envía estas preferencias a servidores externos.
          </p>
        </div>
        <Badge tone="teal">Guardado automático</Badge>
      </header>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel settings-section" aria-labelledby="appearance-settings-title">
            <div className="panel__header">
              <div>
                <h2 id="appearance-settings-title">Apariencia</h2>
                <p>Tema, movimiento y densidad de información.</p>
              </div>
              <MonitorCog size={20} aria-hidden="true" />
            </div>
            <div className="panel__body settings-section__body">
              <fieldset className="settings-fieldset">
                <legend>Tema de color</legend>
                <div className="settings-choice-grid settings-choice-grid--three">
                  <ChoiceButton
                    value="light"
                    selected={preferences.theme === 'light'}
                    label="Claro"
                    description="Contraste sobre fondo marfil"
                    icon={Sun}
                    onSelect={updateTheme}
                  />
                  <ChoiceButton
                    value="dark"
                    selected={preferences.theme === 'dark'}
                    label="Oscuro"
                    description="Superficies de baja luminancia"
                    icon={Moon}
                    onSelect={updateTheme}
                  />
                  <ChoiceButton
                    value="system"
                    selected={preferences.theme === 'system'}
                    label="Sistema"
                    description="Sigue al dispositivo"
                    icon={MonitorCog}
                    onSelect={updateTheme}
                  />
                </div>
              </fieldset>

              <fieldset className="settings-fieldset">
                <legend>Densidad de tablas</legend>
                <div className="settings-choice-grid settings-choice-grid--two">
                  <ChoiceButton
                    value="comfortable"
                    selected={preferences.tableDensity === 'comfortable'}
                    label="Cómoda"
                    description="Más separación entre eventos"
                    icon={Rows3}
                    onSelect={updateDensity}
                  />
                  <ChoiceButton
                    value="compact"
                    selected={preferences.tableDensity === 'compact'}
                    label="Compacta"
                    description="Más filas visibles"
                    icon={Gauge}
                    onSelect={updateDensity}
                  />
                </div>
              </fieldset>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={preferences.reduceMotion}
                  onChange={(event) => {
                    usePreferencesStore.getState().setReduceMotion(event.target.checked);
                    setStatusMessage('Preferencia de movimiento actualizada.');
                  }}
                />
                <span className="settings-toggle__control" aria-hidden="true" />
                <span>
                  <strong>Reducir movimiento</strong>
                  <small>Minimiza transiciones y animaciones no esenciales.</small>
                </span>
              </label>
            </div>
          </section>

          <section className="panel settings-section" aria-labelledby="data-settings-title">
            <div className="panel__header">
              <div>
                <h2 id="data-settings-title">Datos y presentación</h2>
                <p>Valores predeterminados para fechas, regiones y páginas.</p>
              </div>
              <Globe2 size={20} aria-hidden="true" />
            </div>
            <div className="panel__body settings-form-grid">
              <div className="field">
                <label htmlFor="settings-time-zone">Zona horaria</label>
                <select
                  id="settings-time-zone"
                  className="select"
                  value={preferences.timeZone}
                  onChange={(event) => updateTimeZone(parseTimeZonePreference(event.target.value))}
                >
                  <option value="local">Hora local del dispositivo</option>
                  <option value="utc">UTC</option>
                </select>
                <span className="field-hint">Las fechas internas siempre se conservan en UTC.</span>
              </div>

              <div className="field">
                <label htmlFor="settings-page-size">Resultados por página</label>
                <select
                  id="settings-page-size"
                  className="select"
                  value={preferences.defaultPageSize}
                  onChange={(event) => {
                    usePreferencesStore
                      .getState()
                      .setDefaultPageSize(parsePageSize(event.target.value));
                    setStatusMessage('Tamaño de página actualizado.');
                  }}
                >
                  {preferences.defaultPageSize !== 25 &&
                  preferences.defaultPageSize !== 50 &&
                  preferences.defaultPageSize !== 100 ? (
                    <option value={preferences.defaultPageSize}>
                      {preferences.defaultPageSize} resultados · importado
                    </option>
                  ) : null}
                  <option value={25}>25 resultados</option>
                  <option value={50}>50 resultados</option>
                  <option value={100}>100 resultados</option>
                </select>
                <span className="field-hint">
                  Las consultas históricas mantienen paginación controlada.
                </span>
              </div>

              <div className="field settings-form-grid__wide">
                <label htmlFor="settings-initial-region">Región inicial</label>
                <select
                  id="settings-initial-region"
                  className="select"
                  value={preferences.initialRegion}
                  onChange={(event) => {
                    usePreferencesStore
                      .getState()
                      .setInitialRegion(parseRegionPreset(event.target.value));
                    setStatusMessage('Región inicial actualizada.');
                  }}
                >
                  {REGION_PRESET_LIST.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                      {region.approximate ? ' · aproximada' : ''}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Los presets regionales son filtros aproximados; no representan límites tectónicos.
                </span>
              </div>
            </div>
          </section>

          <section className="panel settings-section" aria-labelledby="refresh-settings-title">
            <div className="panel__header">
              <div>
                <h2 id="refresh-settings-title">Autoactualización</h2>
                <p>Consulta de nuevo el feed reciente a un ritmo controlado.</p>
              </div>
              <RefreshCw size={20} aria-hidden="true" />
            </div>
            <div className="panel__body settings-refresh-row">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={preferences.autoRefresh.enabled}
                  onChange={(event) =>
                    updateAutoRefresh(
                      event.target.checked
                        ? { enabled: true, intervalSeconds: autoRefreshInterval }
                        : { enabled: false },
                    )
                  }
                />
                <span className="settings-toggle__control" aria-hidden="true" />
                <span>
                  <strong>Actualizar feeds recientes</strong>
                  <small>
                    Se pausa naturalmente cuando la vista deja de consultar datos en vivo.
                  </small>
                </span>
              </label>
              <div className="field settings-refresh-frequency">
                <label htmlFor="settings-refresh-frequency">Frecuencia</label>
                <select
                  id="settings-refresh-frequency"
                  className="select"
                  value={autoRefreshInterval}
                  disabled={!preferences.autoRefresh.enabled}
                  onChange={(event) =>
                    updateAutoRefresh({
                      enabled: true,
                      intervalSeconds: parseAutoRefreshInterval(event.target.value),
                    })
                  }
                >
                  {AUTO_REFRESH_INTERVALS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      Cada {refreshIntervalLabel(seconds)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </div>

        <aside className="settings-sidebar" aria-label="Administración de preferencias">
          <section className="panel settings-summary" aria-labelledby="settings-summary-title">
            <div className="panel__header">
              <div>
                <h2 id="settings-summary-title">Configuración activa</h2>
                <p>Resumen de este navegador.</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Tema</dt>
                <dd>
                  {preferences.theme === 'system'
                    ? 'Sistema'
                    : preferences.theme === 'dark'
                      ? 'Oscuro'
                      : 'Claro'}
                </dd>
              </div>
              <div>
                <dt>Hora</dt>
                <dd>{preferences.timeZone === 'utc' ? 'UTC' : 'Local'}</dd>
              </div>
              <div>
                <dt>Página</dt>
                <dd>{preferences.defaultPageSize} eventos</dd>
              </div>
              <div>
                <dt>Autoactualización</dt>
                <dd>
                  {preferences.autoRefresh.enabled
                    ? refreshIntervalLabel(preferences.autoRefresh.intervalSeconds)
                    : 'Desactivada'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel settings-maintenance" aria-labelledby="maintenance-title">
            <div className="panel__body">
              <TimerReset size={22} aria-hidden="true" />
              <h2 id="maintenance-title">Restablecer preferencias</h2>
              <p>Vuelve a los valores iniciales sin eliminar búsquedas ni favoritos.</p>
              <Button
                onClick={() => {
                  usePreferencesStore.getState().resetPreferences();
                  setStatusMessage('Preferencias restablecidas.');
                }}
              >
                <RotateCcw size={15} aria-hidden="true" /> Restablecer
              </Button>
            </div>
          </section>

          <section
            className="panel settings-maintenance settings-maintenance--danger"
            aria-labelledby="local-data-title"
          >
            <div className="panel__body">
              <Database size={22} aria-hidden="true" />
              <h2 id="local-data-title">Datos locales</h2>
              <p>Elimina preferencias, favoritos y búsquedas guardadas de este navegador.</p>
              <button
                ref={clearTriggerRef}
                type="button"
                className="button button--danger"
                onClick={() => {
                  setClearError('');
                  setIsClearDialogOpen(true);
                }}
              >
                <Trash2 size={15} aria-hidden="true" /> Borrar datos locales
              </button>
            </div>
          </section>
        </aside>
      </div>

      <p className="settings-status" role="status" aria-live="polite">
        {statusMessage}
      </p>

      <dialog
        ref={clearDialogRef}
        className="settings-confirm-dialog"
        aria-labelledby="clear-data-dialog-title"
        aria-describedby="clear-data-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          closeClearDialog();
        }}
        onClose={() => {
          setIsClearDialogOpen(false);
          clearTriggerRef.current?.focus();
        }}
      >
        <div className="settings-confirm-dialog__icon" aria-hidden="true">
          <Trash2 size={21} />
        </div>
        <h2 id="clear-data-dialog-title">¿Borrar todos los datos locales?</h2>
        <p id="clear-data-dialog-description">
          Esta acción elimina búsquedas, favoritos y preferencias guardadas en este navegador. No
          afecta a USGS ni a ningún dato externo.
        </p>
        {clearError ? (
          <p className="settings-dialog-error" role="alert">
            {clearError}
          </p>
        ) : null}
        <div className="button-row settings-confirm-dialog__actions">
          <button
            ref={cancelClearRef}
            type="button"
            className="button button--secondary"
            onClick={closeClearDialog}
            disabled={isClearing}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() => void confirmClearLocalData()}
            disabled={isClearing}
          >
            <Trash2 size={15} aria-hidden="true" />
            {isClearing ? 'Borrando…' : 'Sí, borrar todo'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
