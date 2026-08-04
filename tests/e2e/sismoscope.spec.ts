import { expect, test, type Page } from '@playwright/test';

import { usgsCollectionFixture, usgsDetailFixture } from '../fixtures/usgs';

async function mockExternalData(page: Page) {
  await page.route('**://earthquake.usgs.gov/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/count')) {
      await route.fulfill({ json: { count: 1, maxAllowed: 20_000 } });
    } else if (url.pathname.includes('/detail/')) {
      await route.fulfill({ json: usgsDetailFixture });
    } else {
      await route.fulfill({ json: usgsCollectionFixture });
    }
  });
  await page.route('**://*.tile.openstreetmap.org/**', (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await mockExternalData(page);
});

test('el enlace de salto mueve el foco sin alterar la ruta hash', async ({ page }) => {
  await page.goto('./#/');
  const routeBeforeSkip = page.url();

  const skipControl = page.getByRole('button', { name: 'Saltar al contenido principal' });
  await skipControl.focus();
  await expect(skipControl).toBeFocused();
  await skipControl.press('Enter');

  await expect(page.locator('#main-content')).toBeFocused();
  expect(page.url()).toBe(routeBeforeSkip);
});

test('dashboard → explorador → selección → detalle', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.getByRole('heading', { name: 'La Tierra, ahora.' })).toBeVisible();
  await page.getByRole('link', { name: /Abrir explorador/ }).click();
  await expect(page.getByRole('heading', { name: 'Explorador sísmico' })).toBeVisible();
  await page.getByRole('button', { name: '20 km O de Lima, Perú', exact: true }).click();
  await page.getByRole('link', { name: /Abrir ficha completa/ }).click();
  await expect(page.getByText('20 km O de Lima, Perú').first()).toBeVisible();
});

test('crea una búsqueda y la recupera después de recargar', async ({ page }) => {
  await page.goto('./#/explorer?time=week');
  await expect(page.getByText('20 km O de Lima, Perú').first()).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByLabel('Nombre').fill('Costa semanal');
  await page
    .locator('.save-query-bar')
    .getByRole('button', { name: 'Guardar', exact: true })
    .click();
  await page.reload();
  await page.getByRole('link', { name: 'Guardados' }).click();
  await expect(page.getByText('Costa semanal')).toBeVisible();
  await page.getByRole('button', { name: /Ejecutar/ }).click();
  await expect(page).toHaveURL(/explorer/);
});

test('analiza resultados y exporta CSV', async ({ page }) => {
  await page.goto('./#/analytics');
  await expect(page.getByText('1 observaciones')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar dataset/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/sismoscope-earthquakes-.*\.csv/);
});

test('persiste tema y zona horaria', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('button', { name: /Oscuro/ }).click();
  await page.getByLabel('Zona horaria').selectOption('utc');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Zona horaria')).toHaveValue('utc');
});

test('muestra un fallo de USGS y permite reintentar', async ({ page }) => {
  let shouldFail = true;
  await page.unroute('**://earthquake.usgs.gov/**');
  await page.route('**://earthquake.usgs.gov/**', async (route) => {
    if (shouldFail) await route.fulfill({ status: 503, json: { message: 'temporary' } });
    else await route.fulfill({ json: usgsCollectionFixture });
  });
  await page.goto('./#/');
  await expect(
    page.getByRole('heading', { name: /No pudimos obtener la actividad reciente/ }),
  ).toBeVisible();
  shouldFail = false;
  await page.getByRole('button', { name: /Reintentar/ }).click();
  await expect(page.getByText('20 km O de Lima, Perú').first()).toBeVisible();
});
