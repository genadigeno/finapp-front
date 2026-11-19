import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    // Pure logic runs in node; a component test opts into jsdom with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['src/testing/setup-dom.ts'],
    // The guard tests lint and scan real files; give them room on a cold cache.
    testTimeout: 60_000,
    maxWorkers: '50%',
  },
});
