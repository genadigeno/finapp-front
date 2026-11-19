// Adapted from finapp-admin-panel/scripts/check-reproducible.mjs (ADR-F08: copied by reading, not shared).
// Builds twice into separate directories and requires byte-identical output (P18-TSK-001's
// acceptance: "a clean clone builds byte-identically twice"). The image built from dist/ is then
// reproducible as far as the application's own bytes go.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** @param {string} dir @returns {Map<string, string>} relative path -> sha256 */
function digest(dir) {
  const out = new Map();
  /** @param {string} d */
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const file = path.join(d, entry);
      if (statSync(file).isDirectory()) walk(file);
      else
        out.set(
          path.relative(dir, file).split(path.sep).join('/'),
          createHash('sha256').update(readFileSync(file)).digest('hex'),
        );
    }
  };
  walk(dir);
  return out;
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
/** @returns {string} the output directory of one fresh build */
const build = () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'customer-web-build-'));
  execFileSync(npx, ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return outDir;
};
const builds = [build(), build()];
const first = digest(builds[0] ?? '');
const second = digest(builds[1] ?? '');
const differences = [];
for (const file of new Set([...first.keys(), ...second.keys()])) {
  if (first.get(file) !== second.get(file)) differences.push(file);
}
for (const dir of builds) rmSync(dir, { recursive: true, force: true });

if (differences.length > 0) {
  console.error('Two builds differ in:');
  for (const f of differences) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`Two builds are byte-identical (${first.size} files).`);
