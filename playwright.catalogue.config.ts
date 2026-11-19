import { defineConfig, devices } from '@playwright/test';

// The catalogue's browser checks (P18-TSK-007; blueprint §22 item 7): axe and the CSP, in a real browser,
// against PRODUCTION builds served with the real headers - the catalogue, and the application itself.
// Adapted from finapp-admin-panel/playwright.catalogue.config.ts (ADR-F08).
//
// PW_CHANNEL picks an installed browser (e.g. `msedge`) when the bundled Chromium is absent; CI installs
// the bundled one.
const channel = process.env['PW_CHANNEL'];

export default defineConfig({
  testDir: './e2e/catalogue',
  fullyParallel: false,
  // One browser at a time: two Edge instances running full-page axe side by side stalled on this machine (Stage 4,
  // dark theme, 90 s timeouts); each project passes alone in under a minute.
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  // A cold first load plus a full axe analysis can exceed Playwright's defaults on a loaded machine.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } },
    {
      // A phone-sized viewport: the bottom navigation and the 44 px targets.
      name: 'phone',
      use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) },
    },
  ],
  webServer: [
    {
      command:
        'npx vite build -c vite.catalogue.config.ts --logLevel warn && npx vite preview -c vite.catalogue.config.ts',
      url: 'http://localhost:4181/catalogue/index.html',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // The REAL application build, previewed with the same headers.
      command: 'npx vite build --logLevel warn && npx vite preview',
      url: 'http://localhost:4180/',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
