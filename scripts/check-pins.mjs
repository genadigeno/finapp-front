// Adapted from finapp-admin-panel/scripts/check-pins.mjs (ADR-F08: copied by reading, not shared).
// Every direct dependency is pinned to an exact version and the lockfile is present and current
// (ADR-F03, following ADR-0025 and ADR-0026 in spirit).
import { readFileSync, existsSync } from 'node:fs';
import { pinViolations } from './lib/pins.mjs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (!existsSync('package-lock.json')) {
  console.error('package-lock.json is missing: installs must be reproducible with `npm ci`.');
  process.exit(1);
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const found = pinViolations(manifest, lock);
if (found.length > 0) {
  console.error('Dependency pinning violated:');
  for (const v of found) console.error(`  ${v}`);
  process.exit(1);
}
console.log('Every direct dependency is pinned exactly and matches the lockfile.');
