import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { CUSTOMER_HEADERS } from './config/customer-web-headers.mjs';

// The Customer Application is served same-origin from the public edge at / (ADR-F01). In development,
// Vite proxies /v1 to the finapp application on its single local port, so the browser sees one origin
// exactly as it will behind the edge: no CORS, ever.
const backend = process.env['FINAPP_BACKEND_URL'] ?? 'http://localhost:8080';

// The dev server carries the session in finapp's HttpOnly cookie (ADR-F02; finapp ADR-0156, X-TSK-029), so a reload
// keeps the customer signed in. finapp reads that cookie on the PUBLIC surface only - which the public edge marks with
// X-Finapp-Surface, and the dev proxy marks here in its place. VITE_SESSION_CARRIER=memory still selects the old carrier;
// a build keeps its own default (RUNBOOK.md), and so do the tests.
const devCarrier = process.env['VITE_SESSION_CARRIER'] ?? 'cookie';

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [react()],
  define: command === 'serve' ? { 'import.meta.env.VITE_SESSION_CARRIER': JSON.stringify(devCarrier) } : {},
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/v1': { target: backend, changeOrigin: false, headers: { 'X-Finapp-Surface': 'public' } },
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
}));
