import { Suspense } from 'react';
import { HashRouter } from 'react-router-dom';

import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';
import { GlobalErrorBoundary } from '@/shared/ui/GlobalErrorBoundary';
import { RouteLoading } from '@/shared/ui/RouteLoading';

export function App() {
  return (
    <GlobalErrorBoundary>
      <AppProviders>
        <HashRouter>
          <Suspense fallback={<RouteLoading />}>
            <AppRouter />
          </Suspense>
        </HashRouter>
      </AppProviders>
    </GlobalErrorBoundary>
  );
}
