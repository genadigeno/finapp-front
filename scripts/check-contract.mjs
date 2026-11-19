// Adapted from finapp-admin-panel/scripts/check-contract.mjs (ADR-F08: copied by reading, not shared).
// The client cannot drift silently from the backend (P18-TSK-002):
//   1. contract/openapi.json is exactly the file contract/SOURCE.json pins (by sha256);
//   2. src/generated/finapp-api.ts is exactly what the generator makes from it.
// A contract change therefore reaches the code only as a regenerated, reviewed, type-checked diff.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CONTRACT_FILE, GENERATED_FILE, SOURCE_FILE, pinProblems } from './lib/contract.mjs';

const problems = pinProblems(readFileSync(CONTRACT_FILE, 'utf8'), JSON.parse(readFileSync(SOURCE_FILE, 'utf8')));

const dir = mkdtempSync(path.join(tmpdir(), 'contract-'));
const fresh = path.join(dir, 'finapp-api.ts');
try {
  execFileSync(process.execPath, ['scripts/contract-generate.mjs', fresh], { stdio: 'inherit' });
  if (readFileSync(fresh, 'utf8') !== readFileSync(GENERATED_FILE, 'utf8')) {
    problems.push(
      `${GENERATED_FILE} is not what the generator makes from ${CONTRACT_FILE}: run \`npm run contract:generate\``,
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error('The pinned contract and the generated client disagree:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
const { commit } = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
console.log(`The client matches the contract pinned at finapp ${commit}.`);
