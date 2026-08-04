import { useEffect, useState } from 'react';

import type { EarthquakeEvent, TimeGranularity } from '@/entities/earthquake';
import type {
  AnalyticsRequest,
  AnalyticsResult,
  AnalyticsWorkerResponse,
} from '@/workers/analytics-types';

export type WorkerState =
  | { status: 'idle' | 'loading'; result: null; error: null }
  | { status: 'success'; result: AnalyticsResult; error: null }
  | { status: 'error'; result: null; error: string };

export function useWorkerAnalytics(
  events: readonly EarthquakeEvent[],
  granularity: TimeGranularity,
): WorkerState {
  const [calculation, setCalculation] = useState<{
    events: readonly EarthquakeEvent[];
    granularity: TimeGranularity;
    state: WorkerState;
  } | null>(null);

  useEffect(() => {
    if (!events.length) return undefined;
    const worker = new Worker(
      new URL('../../workers/earthquake-analytics.worker.ts', import.meta.url),
      {
        type: 'module',
      },
    );
    const taskId = crypto.randomUUID();
    worker.addEventListener('message', (event: MessageEvent<AnalyticsWorkerResponse>) => {
      if (event.data.taskId !== taskId) return;
      if (event.data.type === 'result') {
        setCalculation({
          events,
          granularity,
          state: { status: 'success', result: event.data.result, error: null },
        });
      } else {
        setCalculation({
          events,
          granularity,
          state: { status: 'error', result: null, error: event.data.message },
        });
      }
    });
    const request: AnalyticsRequest = { type: 'calculate', taskId, events, granularity };
    worker.postMessage(request);
    return () => worker.terminate();
  }, [events, granularity]);

  if (!events.length) return { status: 'idle', result: null, error: null };
  if (calculation?.events !== events || calculation.granularity !== granularity) {
    return { status: 'loading', result: null, error: null };
  }
  return calculation.state;
}
