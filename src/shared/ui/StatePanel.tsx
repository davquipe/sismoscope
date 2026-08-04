import { AlertTriangle, Inbox, RotateCcw, WifiOff } from 'lucide-react';

import { Button } from '@/shared/ui/Button';

interface StatePanelProps {
  type: 'empty' | 'error' | 'offline';
  title: string;
  description: string;
  onRetry?: () => void;
}

export function StatePanel({ type, title, description, onRetry }: StatePanelProps) {
  const Icon = type === 'empty' ? Inbox : type === 'offline' ? WifiOff : AlertTriangle;
  return (
    <section className="state-panel" role={type === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry ? (
        <Button onClick={onRetry}>
          <RotateCcw size={15} aria-hidden="true" /> Reintentar
        </Button>
      ) : null}
    </section>
  );
}
