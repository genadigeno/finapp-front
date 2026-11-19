import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { CUSTOMER_HEADERS } from './config/customer-web-headers.mjs';

// The component catalogue (P18-TSK-007): a PRODUCTION build of every design-system component, previewed
// with the real headers, so axe and the CSP judge what customers will actually get. Test tooling only:
// a separate build into dist-catalogue/, never part of dist/.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist-catalogue',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2023',
    assetsInlineLimit: 0,
    rolldownOptions: { input: 'catalogue/index.html' },
  },
  preview: {
    port: 4181,
    strictPort: true,
    headers: CUSTOMER_HEADERS,
  },
});
