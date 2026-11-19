// Adapted from finapp-admin-panel/scripts/contract-pull.mjs (ADR-F08: copied by reading, not shared).
// Pins the backend contract (ADR-F01): copies finapp's published docs/api/openapi.json
// at a named commit into contract/, recording where it came from and its digest.
//
//   node scripts/contract-pull.mjs <path-to-finapp-checkout> [ref=HEAD]
//
// The pin is the commit, not a branch: a release names the exact backend contract it was
// built against. After pulling, run `npm run contract:generate` and commit both.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { sha256, SOURCE_FILE, CONTRACT_FILE, CONTRACT_PATH_IN_FINAPP } from './lib/contract.mjs';

const [finapp, ref = 'HEAD'] = process.argv.slice(2);
if (finapp === undefined) {
  console.error('usage: node scripts/contract-pull.mjs <path-to-finapp-checkout> [ref]');
  process.exit(2);
}

const git = (/** @type {string[]} */ ...args) =>
  execFileSync('git', ['-C', finapp, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const commit = git('rev-parse', '--verify', `${ref}^{commit}`).trim();
const contract = git('show', `${commit}:${CONTRACT_PATH_IN_FINAPP}`);
JSON.parse(contract); // refuse to pin something that is not JSON

mkdirSync('contract', { recursive: true });
writeFileSync(CONTRACT_FILE, contract);
const source = { repository: 'finapp', commit, path: CONTRACT_PATH_IN_FINAPP, sha256: sha256(contract) };
writeFileSync(SOURCE_FILE, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Pinned ${CONTRACT_PATH_IN_FINAPP} at finapp ${commit} (sha256 ${source.sha256}).`);
