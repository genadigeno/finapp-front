// Adapted from finapp-admin-panel/scripts/lib/bundle-scan.mjs (ADR-F08: copied by reading, not shared).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

/** Markers that only test doubles carry; their presence means test code shipped (DOD-CUST: no mock data outside tests). */
const TEST_DOUBLE_MARKERS = ['mockServiceWorker', 'msw/browser', 'setupWorker(', '[MSW]'];

/**
 * Scans a built bundle directory. Returns the violations; an empty list is a pass.
 * @param {string} directory
 * @returns {string[]}
 */
export function scanBundle(directory) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const file = path.join(dir, entry);
      if (statSync(file).isDirectory()) {
        walk(file);
        continue;
      }
      const relative = path.relative(directory, file).split(path.sep).join('/');
      if (relative.endsWith('.map')) found.push(`${relative}: a source map is in the bundle`);
      if (/mockServiceWorker/i.test(entry)) found.push(`${relative}: a service-worker test double is in the bundle`);
      if (/\.(js|mjs|css|html)$/.test(entry)) {
        const text = readFileSync(file, 'utf8');
        if (text.includes('sourceMappingURL=')) found.push(`${relative}: references a source map`);
        for (const marker of TEST_DOUBLE_MARKERS) {
          if (text.includes(marker)) found.push(`${relative}: contains test-double marker "${marker}"`);
        }
      }
    }
  };
  walk(directory);
  return found;
}

/**
 * The performance budget (blueprint §16: initial JavaScript at most 200 kB gzip for the signed-in shell):
 *   - the first load - the entry plus every chunk index.html loads or preloads - at most 200 KiB of
 *     gzipped JavaScript (the blueprint's budget; 186 kB at Stage 1, 195 kB at Stage 2, 187 kB at Stage 3);
 *   - the same first load at most 700 KiB raw (596 KiB at Stage 1);
 *   - the entry chunk at most 128 KiB raw, so module code stays out of it. 40 KiB at Stage 1; 83 KiB at Stage 2,
 *     when Mantine stopped being one vendor chunk (that chunk put every component any page uses into the first load)
 *     and its shared core moved into the entry - cap 64 -> 96 KiB; 124 KiB at Stage 3, when the step-up dialog's
 *     positioning and scroll code (floating-ui, ScrollArea), also used by the pages' selects, moved from a separate
 *     first-load chunk into the entry - the same bytes, one file fewer - cap 96 -> 128 KiB. The gzip first-load
 *     budget is the binding one; this cap catches a page pulled into the entry;
 *   - any single JavaScript chunk at most 256 KiB raw.
 * A heavy dependency or a module pulled into the entry fails the build instead of creeping in. Raise a limit
 * only with a recorded reason.
 */
export const BUDGET = { entry: 128 * 1024, chunk: 256 * 1024, firstLoad: 700 * 1024, firstLoadGzip: 200 * 1024 };

/**
 * @param {string} directory
 * @returns {{ violations: string[], entry: number, firstLoad: number, firstLoadGzip: number, largest: number }}
 */
export function checkBudget(directory) {
  /** @type {string[]} */
  const violations = [];
  const assets = path.join(directory, 'assets');
  let largest = 0;
  for (const name of readdirSync(assets)) {
    if (!name.endsWith('.js')) continue;
    const size = statSync(path.join(assets, name)).size;
    largest = Math.max(largest, size);
    if (size > BUDGET.chunk)
      violations.push(`assets/${name}: ${size} bytes, over the ${BUDGET.chunk}-byte chunk budget`);
  }
  const html = readFileSync(path.join(directory, 'index.html'), 'utf8');
  const loaded = [...html.matchAll(/(?:src|href)="[^"]*\/(assets\/[^"]+\.js)"/g)].map((m) => m[1] ?? '');
  const entryFile = /<script[^>]*type="module"[^>]*src="[^"]*\/(assets\/[^"]+\.js)"/.exec(html)?.[1];
  const sizeOf = (/** @type {string} */ file) => statSync(path.join(directory, file)).size;
  const entry = entryFile === undefined ? 0 : sizeOf(entryFile);
  const firstLoadFiles = [...new Set(loaded)];
  const firstLoad = firstLoadFiles.reduce((sum, file) => sum + sizeOf(file), 0);
  const firstLoadGzip = firstLoadFiles.reduce(
    (sum, file) => sum + gzipSync(readFileSync(path.join(directory, file))).length,
    0,
  );
  if (entryFile === undefined) violations.push('index.html: no module entry script found');
  if (entry > BUDGET.entry) violations.push(`${entryFile}: ${entry} bytes, over the ${BUDGET.entry}-byte entry budget`);
  if (firstLoad > BUDGET.firstLoad)
    violations.push(`first load: ${firstLoad} bytes, over the ${BUDGET.firstLoad}-byte budget`);
  if (firstLoadGzip > BUDGET.firstLoadGzip)
    violations.push(`first load: ${firstLoadGzip} bytes gzipped, over the ${BUDGET.firstLoadGzip}-byte budget`);
  return { violations, entry, firstLoad, firstLoadGzip, largest };
}
