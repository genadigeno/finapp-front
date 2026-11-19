import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { theme } from '../src/design-system/theme.ts';
import { themeStylesheet } from '../src/design-system/theme-stylesheet.ts';

const FILE = 'src/design-system/theme.generated.css';

// The static stylesheet that replaces MantineProvider's inline <style> injection (ADR-F07 decision 1).
// `npm run theme:generate` sets UPDATE_THEME_CSS=1 to rewrite it; otherwise any drift fails the build.
describe('the static theme stylesheet', () => {
  const expected = themeStylesheet(theme);

  if (process.env['UPDATE_THEME_CSS'] === '1') {
    it('is regenerated', () => {
      writeFileSync(FILE, expected);
      expect(readFileSync(FILE, 'utf8')).toBe(expected);
    });
    return;
  }

  it('matches the theme exactly', () => {
    expect(existsSync(FILE), `${FILE} is missing: run npm run theme:generate`).toBe(true);
    expect(readFileSync(FILE, 'utf8'), `${FILE} is stale: run npm run theme:generate`).toBe(expected);
  });

  it('carries both colour schemes, the application tokens and the breakpoint classes', () => {
    expect(expected).toContain('[data-mantine-color-scheme="dark"]');
    expect(expected).toContain('--mantine-color-scheme: light');
    expect(expected).toContain('--finapp-touch-target');
    expect(expected).toContain('.mantine-hidden-from-sm');
  });
});
