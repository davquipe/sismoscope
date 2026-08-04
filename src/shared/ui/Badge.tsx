import type { PropsWithChildren } from 'react';

type Tone = 'neutral' | 'teal' | 'amber' | 'critical' | 'blue';

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: Tone }>) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
