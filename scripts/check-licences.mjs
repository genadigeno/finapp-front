// Adapted from finapp-admin-panel/scripts/check-licences.mjs (ADR-F08: copied by reading, not shared).
// Fails the build when any installed package's licence is outside the policy (ADR-F03).
// The package list comes from `npm query`, so it is exactly what `npm ci` installed.
import { execFileSync } from 'node:child_process';
import { violations } from './lib/licence-policy.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const raw = execFileSync(npm, ['query', '*'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  shell: process.platform === 'win32',
});
/** @type {Array<{ name: string, version: string, license?: unknown, dev?: boolean, location: string }>} */
const nodes = JSON.parse(raw).filter((/** @type {{ location: string }} */ n) => n.location !== '');

const packages = nodes.map((n) => ({ name: n.name, version: n.version, license: n.license, dev: n.dev === true }));
const found = violations(packages);
const shipped = packages.filter((p) => !p.dev).length;

if (found.length > 0) {
  console.error(`Licence policy violated by ${found.length} package(s):`);
  for (const v of found) console.error(`  [${v.scope}] ${v.name}@${v.version}: ${v.license}`);
  process.exit(1);
}
console.log(`Licence policy holds: ${shipped} shipped and ${packages.length - shipped} tooling packages checked.`);
