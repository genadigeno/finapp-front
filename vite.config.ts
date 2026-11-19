import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { CUSTOMER_HEADERS } from './config/customer-web-headers.mjs';

// The Customer Application is served same-origin from the public edge at / (ADR-F01). In development,
// Vite proxies /v1 to the finapp application on its single local port, so the browser sees one origin
// exactly as it will behind the edge: no CORS, ever.
const backend = process.env['FINAPP_BACKEND_URL'] ?? 'http://localhost:8080';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/v1': { target: backend, changeOrigin: false },
    },
  },
  preview: {
    port: 4180,
    strictPort: true,
    // The production build previewed with the real headers (ADR-F07).
    headers: CUSTOMER_HEADERS,
  },
  build: {
    // No source maps in the shipped bundle (ADR-F03); check-bundle enforces it.
    sourcemap: false,
    target: 'es2023',
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Libraries in long-cached chunks of their own; each module's pages load on first visit. Mantine is NOT
        // grouped: one Mantine chunk would put every component any page uses (Select, FileInput, Table…) into
        // the first load. Left to the bundler, a page-only component travels with its page (Stage 2 budget).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'intl', test: /node_modules[\\/](react-intl|@formatjs|intl-messageformat)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]@tabler[\\/]/ },
          ],
        },
      },
    },
  },
});
