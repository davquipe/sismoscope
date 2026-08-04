import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';

import { applyThemePreference, usePreferencesStore } from '@/app/store/preferences-store';
import { isRecoverableError } from '@/shared/errors/error-policy';

function PreferenceEffects() {
  const theme = usePreferencesStore((state) => state.preferences.theme);
  const reduceMotion = usePreferencesStore((state) => state.preferences.reduceMotion);

  useEffect(() => {
    applyThemePreference(theme);
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => applyThemePreference('system');
    media.addEventListener('change', syncTheme);
    return () => media.removeEventListener('change', syncTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => failureCount < 2 && isRecoverableError(error),
          },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            if (import.meta.env.DEV) {
              console.error('[SismoScope:query]', error);
            }
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferenceEffects />
      {children}
    </QueryClientProvider>
  );
}
