import { ArrowUpRight, Bookmark, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { usePreferencesStore } from '@/app/store/preferences-store';
import type { EarthquakeEvent, EarthquakeId } from '@/entities/earthquake/model/types';
import { MagnitudeIndicator } from '@/entities/earthquake/ui/MagnitudeIndicator';
import { formatDateTime, formatNumber, formatRelativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';

interface EarthquakeTableProps {
  events: readonly EarthquakeEvent[];
  selectedId: EarthquakeId | null;
  onSelect: (event: EarthquakeEvent) => void;
  onFavorite?: (event: EarthquakeEvent) => void;
}

export function EarthquakeTable({
  events,
  selectedId,
  onSelect,
  onFavorite,
}: EarthquakeTableProps) {
  const timeZone = usePreferencesStore((state) => state.preferences.timeZone);
  const density = usePreferencesStore((state) => state.preferences.tableDensity);

  return (
    <div className="data-table-wrap" tabIndex={0} aria-label="Resultados sísmicos desplazables">
      <table className={`data-table earthquake-table earthquake-table--${density}`}>
        <caption className="sr-only">
          Eventos sísmicos. Selecciona un lugar para sincronizarlo con el mapa.
        </caption>
        <thead>
          <tr>
            <th scope="col">Mag.</th>
            <th scope="col">Lugar</th>
            <th scope="col">Fecha y hora</th>
            <th scope="col">Profundidad</th>
            <th scope="col">Sig.</th>
            <th scope="col">Reportes</th>
            <th scope="col">Alerta</th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className={selectedId === event.id ? 'is-selected' : undefined}>
              <td>
                <MagnitudeIndicator magnitude={event.magnitude} compact />
              </td>
              <td>
                <button
                  className="table-place-button"
                  type="button"
                  onClick={() => onSelect(event)}
                >
                  {event.place}
                </button>
                <span className="table-subvalue mono">
                  {event.sourceNetwork.toUpperCase()} · {event.id}
                </span>
              </td>
              <td>
                <time dateTime={event.occurredAt}>
                  {formatDateTime(event.occurredAt, timeZone)}
                </time>
                <span className="table-subvalue">{formatRelativeTime(event.occurredAt)}</span>
              </td>
              <td className="mono">{formatNumber(event.coordinates.depthKm, ' km')}</td>
              <td className="mono">{event.significance}</td>
              <td>
                {event.feltReports === null ? (
                  <span className="muted">—</span>
                ) : (
                  <span className="inline-signal">
                    <MessageCircle size={13} aria-hidden="true" /> {event.feltReports}
                  </span>
                )}
              </td>
              <td>
                {event.alertLevel ? <Badge tone="amber">{event.alertLevel}</Badge> : <span>—</span>}
              </td>
              <td>
                <Badge tone={event.reviewStatus === 'reviewed' ? 'teal' : 'neutral'}>
                  {event.reviewStatus === 'reviewed' ? 'Revisado' : 'Automático'}
                </Badge>
              </td>
              <td>
                <div className="table-actions">
                  {onFavorite ? (
                    <button
                      type="button"
                      className="table-icon-action"
                      onClick={() => onFavorite(event)}
                      aria-label={`Guardar ${event.place} como favorito`}
                    >
                      <Bookmark size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                  <Link
                    className="table-icon-action"
                    to={`/events/${event.id}`}
                    state={{ detailUrl: event.detailUrl }}
                    aria-label={`Abrir detalle de ${event.place}`}
                  >
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
