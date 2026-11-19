import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanBundle } from '../scripts/lib/bundle-scan.mjs';

const dirs: string[] = [];
const bundle = (files: Record<string, string>) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bundle-scan-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('production bundle scan (ADR-F03)', () => {
  it('passes a clean bundle', () => {
    expect(scanBundle(bundle({ 'index.html': '<html></html>', 'assets/index-abc.js': 'console.log(1)' }))).toEqual([]);
  });

  it('fails a source map file', () => {
    expect(scanBundle(bundle({ 'assets/index-abc.js.map': '{}' }))).toEqual([
      'assets/index-abc.js.map: a source map is in the bundle',
    ]);
  });

  it('fails a sourceMappingURL reference', () => {
    expect(scanBundle(bundle({ 'assets/a.js': 'x\n//# sourceMappingURL=a.js.map' }))).toHaveLength(1);
  });

  it('fails MSW shipped in the bundle - the acceptance probe', () => {
    const found = scanBundle(bundle({ 'mockServiceWorker.js': '/* msw */', 'assets/a.js': 'setupWorker(handlers)' }));
    expect(found).toContain('mockServiceWorker.js: a service-worker test double is in the bundle');
    expect(found).toContain('assets/a.js: contains test-double marker "setupWorker("');
  });
});
