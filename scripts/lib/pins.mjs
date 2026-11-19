// Adapted from finapp-admin-panel/scripts/lib/pins.mjs (ADR-F08: copied by reading, not shared).
const EXACT = /^\d+\.\d+\.\d+$/;

/**
 * @param {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} manifest
 * @param {{ lockfileVersion?: number, packages?: Record<string, { version?: string }> }} lock
 * @returns {string[]} violations; empty is a pass
 */
export function pinViolations(manifest, lock) {
  /** @type {string[]} */
  const found = [];
  if (lock.lockfileVersion !== 3) found.push(`lockfileVersion is ${lock.lockfileVersion}, expected 3`);
  for (const section of /** @type {const} */ (['dependencies', 'devDependencies'])) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (!EXACT.test(spec)) {
        found.push(`${section}.${name} is "${spec}", not an exact version`);
        continue;
      }
      const locked = lock.packages?.[`node_modules/${name}`]?.version;
      if (locked !== spec) found.push(`${name}: package.json says ${spec}, the lockfile says ${locked ?? '(absent)'}`);
    }
  }
  return found;
}
