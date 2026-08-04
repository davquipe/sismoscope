import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const defaultBase = mode === 'production' ? '/sismoscope/' : '/';

  return {
    base: env.VITE_BASE_PATH || defaultBase,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    build: {
      sourcemap: false,
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('leaflet')) return 'map';
            if (id.includes('echarts')) return 'charts';
            if (id.includes('@tanstack')) return 'query';
            return undefined;
          },
        },
      },
    },
  };
});
