import { ArrowUpRight, Bell, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { EarthquakeEvent } from '@/entities/earthquake/model/types';
import { MagnitudeIndicator } from '@/entities/earthquake/ui/MagnitudeIndicator';
import { usePreferencesStore } from '@/app/store/preferences-store';
import { formatDateTime, formatNumber, formatRelativeTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';

export function EventListItem({ event }: { event: EarthquakeEvent }) {
  const timeZone = usePreferencesStore((state) => state.preferences.timeZone);
  return (
    <article className="event-list-item">
      <MagnitudeIndicator magnitude={event.magnitude} />
      <div className="event-list-item__main">
        <h3>
          <Link to={`/events/${event.id}`} state={{ detailUrl: event.detailUrl }}>
            {event.place}
          </Link>
        </h3>
        <p>
          <time dateTime={event.occurredAt}>{formatRelativeTime(event.occurredAt)}</time>
          <span aria-hidden="true"> · </span>
          <span>{formatNumber(event.coordinates.depthKm, ' km')} de profundidad</span>
        </p>
        <span className="sr-only">{formatDateTime(event.occurredAt, timeZone)}</span>
      </div>
      <div className="event-list-item__meta">
        {event.alertLevel ? <Badge tone="amber">PAGER {event.alertLevel}</Badge> : null}
        {event.feltReports !== null && event.feltReports > 0 ? (
          <span className="event-list-item__signal" title="Reportes de percepción">
            <MessageCircle size={13} aria-hidden="true" /> {event.feltReports}
          </span>
        ) : null}
        {event.tsunamiFlag ? (
          <span className="event-list-item__signal" title="Indicador de tsunami en la fuente">
            <Bell size={13} aria-hidden="true" /> Fuente: tsunami
          </span>
        ) : null}
        <Link
          className="event-list-item__open"
          to={`/events/${event.id}`}
          state={{ detailUrl: event.detailUrl }}
          aria-label={`Abrir detalle de ${event.place}`}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
