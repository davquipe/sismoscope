interface MagnitudeIndicatorProps {
  magnitude: number | null;
  compact?: boolean;
}

function magnitudeClass(magnitude: number | null): string {
  if (magnitude === null) return 'unknown';
  if (magnitude >= 6) return 'strong';
  if (magnitude >= 4.5) return 'moderate';
  if (magnitude >= 2.5) return 'light';
  return 'micro';
}

export function MagnitudeIndicator({ magnitude, compact = false }: MagnitudeIndicatorProps) {
  const label = magnitude === null ? 'Magnitud no disponible' : `Magnitud ${magnitude.toFixed(1)}`;
  return (
    <span
      className={`magnitude magnitude--${magnitudeClass(magnitude)}${compact ? ' magnitude--compact' : ''}`}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{magnitude === null ? '—' : magnitude.toFixed(1)}</span>
    </span>
  );
}
