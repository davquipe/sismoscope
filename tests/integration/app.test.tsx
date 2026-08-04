import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/app/App';
import { usgsCollectionFixture } from '../fixtures/usgs';
import { server } from './server';

vi.mock('@/widgets/earthquake-map/EarthquakeMap', () => ({
  default: () => <div role="img" aria-label="Mapa sísmico de prueba" />,
}));

vi.mock('@/shared/ui/AsyncChart', () => ({
  AsyncChart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}));

describe('flujos principales de SismoScope', () => {
  it('muestra el dashboard con un feed validado', async () => {
    window.location.hash = '#/';
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'La Tierra, ahora.' })).toBeInTheDocument();
    expect(await screen.findByText('20 km O de Lima, Perú')).toBeInTheDocument();
    expect(screen.getByText(/Actualizado/)).toBeInTheDocument();
  });

  it('presenta un error recuperable cuando USGS no responde', async () => {
    server.use(
      http.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/:feed', () =>
        HttpResponse.json({ message: 'unavailable' }, { status: 503 }),
      ),
    );
    window.location.hash = '#/';
    render(<App />);

    expect(
      await screen.findByRole(
        'heading',
        { name: /No pudimos obtener la actividad reciente/ },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('distingue un feed vacío de un fallo', async () => {
    server.use(
      http.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/:feed', () =>
        HttpResponse.json({
          ...usgsCollectionFixture,
          metadata: { ...usgsCollectionFixture.metadata, count: 0 },
          bbox: null,
          features: [],
        }),
      ),
    );
    window.location.hash = '#/';
    render(<App />);

    expect(
      await screen.findByText('0', { selector: '.activity-ledger__intro h2' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin eventos para destacar' })).toBeInTheDocument();
  });

  it('descarta una respuesta externa inválida', async () => {
    server.use(
      http.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/:feed', () =>
        HttpResponse.json({ type: 'FeatureCollection', metadata: {}, features: [] }),
      ),
    );
    window.location.hash = '#/';
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /No pudimos obtener la actividad reciente/ }),
    ).toBeInTheDocument();
  });

  it('consulta el explorador y conserva los filtros en el hash', async () => {
    const user = userEvent.setup();
    let requestedMinimumMagnitude = '';
    server.use(
      http.get('https://earthquake.usgs.gov/fdsnws/event/1/count', ({ request }) => {
        requestedMinimumMagnitude = new URL(request.url).searchParams.get('minmagnitude') ?? '';
        return HttpResponse.json({ count: 1, maxAllowed: 20_000 });
      }),
      http.get('https://earthquake.usgs.gov/fdsnws/event/1/query', () =>
        HttpResponse.json(usgsCollectionFixture),
      ),
    );
    window.location.hash = '#/explorer';
    render(<App />);

    expect(await screen.findByText('20 km O de Lima, Perú')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Magnitud mín.'));
    await user.type(screen.getByLabelText('Magnitud mín.'), '4');
    await user.click(screen.getByRole('button', { name: /Consultar USGS/ }));

    await waitFor(() => expect(window.location.hash).toContain('minMag=4'));
    await waitFor(() => expect(requestedMinimumMagnitude).toBe('4'));
  });

  it('muestra una ficha técnica validada y consulta eventos cercanos sin inferir relación', async () => {
    window.location.hash = '#/events/us-test-1';
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: '20 km O de Lima, Perú' }),
    ).toBeInTheDocument();
    expect(screen.getByText('CDI — intensidad comunitaria')).toBeInTheDocument();
    expect(screen.getByText('MMI — intensidad instrumental')).toBeInTheDocument();
    expect(screen.getByText('Calidad del registro')).toBeInTheDocument();
    expect(screen.getByText('Productos técnicos disponibles')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Eventos cercanos en tiempo y espacio' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/la proximidad no implica relación causal/i)).toBeInTheDocument();
    expect(screen.queryByText(/réplica/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir ficha original de USGS/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('mantiene una alternativa accesible fuera del mapa', async () => {
    window.location.hash = '#/about';
    const { container } = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Sobre SismoScope' })).toBeInTheDocument();

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
