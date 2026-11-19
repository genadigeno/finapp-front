// Adapted from finapp-admin-panel/scripts/check-bundle.mjs (ADR-F08: copied by reading, not shared).
// Fails when the production bundle carries a source map or test code (ADR-F03; DOD-CUST: no mock data outside tests).
import { existsSync } from 'node:fs';
import { checkBudget, scanBundle } from './lib/bundle-scan.mjs';

const directory = process.argv[2] ?? 'dist';
if (!existsSync(directory)) {
  console.error(`${directory}/ does not exist: run the build first.`);
  process.exit(1);
}
const budget = checkBudget(directory);
const found = [...scanBundle(directory), ...budget.violations];
if (found.length > 0) {
  console.error('The production bundle is not clean:');
  for (const v of found) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`The bundle in ${directory}/ carries no source map and no test double.`);
console.log(
  `Within budget: entry ${budget.entry} B, first load ${budget.firstLoad} B (${budget.firstLoadGzip} B gzipped), largest chunk ${budget.largest} B.`,
);
