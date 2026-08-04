import { defineConfig, devices } from '@playwright/test';

const rawBasePath = process.env.VITE_BASE_PATH || '/sismoscope/';
const trimmedBasePath = rawBasePath.replace(/^\/+|\/+$/g, '');
const basePath = trimmedBasePath ? `/${trimmedBasePath}/` : '/';
const previewUrl = `http://127.0.0.1:4173${basePath}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: previewUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 4173',
    url: previewUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
