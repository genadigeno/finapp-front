// Adapted from finapp-admin-panel/scripts/theme-generate.mjs (ADR-F08: copied by reading, not shared).
// Rewrites src/design-system/theme.generated.css from the theme (ADR-F07), by running the
// stylesheet test in update mode - the same code path that checks it, so the two cannot disagree.
import { execFileSync } from 'node:child_process';

execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', 'tests/theme-stylesheet.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, UPDATE_THEME_CSS: '1' },
  shell: process.platform === 'win32',
});
