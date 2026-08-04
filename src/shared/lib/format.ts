export type DisplayTimeZone = 'utc' | 'local';

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });

export function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No disponible';
  return `${numberFormat.format(value)}${suffix}`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No disponible';
  return integerFormat.format(value);
}

export function formatDateTime(
  isoDate: string,
  timeZone: DisplayTimeZone = 'local',
  format: 'short' | 'long' = 'short',
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: format === 'long' ? 'long' : 'medium',
    timeStyle: 'medium',
    ...(timeZone === 'utc' ? { timeZone: 'UTC' } : {}),
  };
  return new Intl.DateTimeFormat('es-PE', options).format(date);
}

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function formatRelativeTime(isoDate: string, now = Date.now()): string {
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) return 'Fecha no disponible';
  const elapsedSeconds = Math.round((time - now) / 1000);
  if (Math.abs(elapsedSeconds) < 60) return relativeFormatter.format(elapsedSeconds, 'second');
  const minutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeFormatter.format(days, 'day');
  return relativeFormatter.format(Math.round(days / 30), 'month');
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'O'}`;
  return `${lat}, ${lon}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No calculado';
  return new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  );
}
