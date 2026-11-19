import { describe, expect, it } from 'vitest';
import { pinViolations } from '../scripts/lib/pins.mjs';

const lock = (versions: Record<string, string>) => ({
  lockfileVersion: 3,
  packages: Object.fromEntries(Object.entries(versions).map(([n, v]) => [`node_modules/${n}`, { version: v }])),
});

describe('dependency pinning (ADR-F03)', () => {
  it('passes exact versions that match the lockfile', () => {
    expect(pinViolations({ dependencies: { react: '19.3.1' } }, lock({ react: '19.3.1' }))).toEqual([]);
  });

  it('fails a range specifier', () => {
    expect(pinViolations({ devDependencies: { vite: '^8.3.8' } }, lock({ vite: '8.3.8' }))).toEqual([
      'devDependencies.vite is "^8.3.8", not an exact version',
    ]);
  });

  it('fails a manifest that disagrees with the lockfile', () => {
    expect(pinViolations({ dependencies: { react: '19.3.1' } }, lock({ react: '19.3.0' }))).toHaveLength(1);
  });

  it('fails an old lockfile format', () => {
    expect(pinViolations({}, { lockfileVersion: 2, packages: {} })).toHaveLength(1);
  });
});
