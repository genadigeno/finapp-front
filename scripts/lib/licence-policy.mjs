// Adapted from finapp-admin-panel/scripts/lib/licence-policy.mjs (ADR-F08: copied by reading, not shared).
// Licence policy (ADR-F03).
//
// What SHIPS to the browser (the production dependency closure) may carry only the licences the
// ADR names. Build and test tooling never reaches a customer's browser, so it may also carry a
// short list of further permissive licences - but never a copyleft one, and never an unknown.

/**
 * Licences allowed in the shipped bundle - ADR-F03's MIT / Apache-2.0 list with the permissive licences the console's policy admits, plus 0BSD
 * (Mantine brings tslib: 0BSD is public-domain-equivalent, strictly more
 * permissive than MIT, and requires no attribution).
 */
export const SHIPPED_ALLOWED = new Set(['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD']);

/** Further permissive licences tolerated in development tooling only. */
export const TOOLING_ALLOWED = new Set([
  ...SHIPPED_ALLOWED,
  'MIT-0',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'Python-2.0',
  'Unlicense',
]);

/**
 * Named exceptions: a specific package, in tooling scope only, with its licence and the reason.
 * Each is a deliberate decision recorded here; an exception never extends to the shipped bundle.
 * @type {ReadonlyArray<{ name: RegExp, license: string, reason: string }>}
 */
export const TOOLING_EXCEPTIONS = [
  {
    name: /^lightningcss(-[a-z0-9-]+)?$/,
    license: 'MPL-2.0',
    reason:
      "Vite 8's CSS transformer, run at build time only; MPL-2.0 is file-level copyleft on its own source, none of which ships in the bundle.",
  },
  {
    name: /^(axe-core|@axe-core\/playwright)$/,
    license: 'MPL-2.0',
    reason:
      'The accessibility engine the catalogue and E2E tests run (DOD-UI: axe clean); test-time only, never in the bundle.',
  },
];

/**
 * Named exceptions that may SHIP: one package, one licence, one reason. Kept apart from the tooling
 * list so a shipped exception is never granted by accident, and narrow so the licence is not allowed
 * for anything else.
 * @type {ReadonlyArray<{ name: RegExp, license: string, reason: string }>}
 */
export const SHIPPED_EXCEPTIONS = [
  {
    name: /^isbot$/,
    license: 'Unlicense',
    reason:
      'Pulled in by @tanstack/react-router for server-rendering bot detection, which this application (a static SPA) never uses. The Unlicense is a public-domain dedication with a permissive fallback grant. It is named here rather than allowed generally because its standing is debated where public domain does not exist.',
  },
];

/**
 * Normalises npm's `license` field, which may be a string, a legacy object or a legacy array.
 * @param {unknown} raw
 * @returns {string | undefined}
 */
export function licenceExpression(raw) {
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  if (Array.isArray(raw)) {
    const parts = raw.map((l) => licenceExpression(l)).filter((l) => l !== undefined);
    return parts.length > 0 ? `(${parts.join(' OR ')})` : undefined;
  }
  if (raw !== null && typeof raw === 'object' && 'type' in raw) {
    return licenceExpression(/** @type {{ type: unknown }} */ (raw).type);
  }
  return undefined;
}

/**
 * True when an SPDX expression is satisfiable from the allowed set. `OR` needs one side, `AND`
 * needs both, parentheses group; `WITH` exceptions are judged by their base licence.
 * @param {string} expression
 * @param {Set<string>} allowed
 * @returns {boolean}
 */
export function satisfies(expression, allowed) {
  const tokens = expression.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').split(/\s+/).filter(Boolean);
  let position = 0;
  /** @returns {boolean} */
  const parseOr = () => {
    let value = parseAnd();
    while (tokens[position]?.toUpperCase() === 'OR') {
      position += 1;
      const right = parseAnd();
      value = value || right;
    }
    return value;
  };
  /** @returns {boolean} */
  const parseAnd = () => {
    let value = parseAtom();
    while (tokens[position]?.toUpperCase() === 'AND') {
      position += 1;
      const right = parseAtom();
      value = value && right;
    }
    return value;
  };
  /** @returns {boolean} */
  const parseAtom = () => {
    const token = tokens[position];
    position += 1;
    if (token === '(') {
      const value = parseOr();
      position += 1; // ')'
      return value;
    }
    if (token === undefined) return false;
    if (tokens[position]?.toUpperCase() === 'WITH') position += 2;
    return allowed.has(token.replace(/\+$/, ''));
  };
  const result = parseOr();
  return result && position === tokens.length;
}

/**
 * Judges every installed package. Returns the violations; an empty list is a pass.
 * @param {Array<{ name: string, version: string, license?: unknown, dev: boolean }>} packages
 * @returns {Array<{ name: string, version: string, license: string, scope: 'shipped' | 'tooling' }>}
 */
export function violations(packages) {
  /** @type {Array<{ name: string, version: string, license: string, scope: 'shipped' | 'tooling' }>} */
  const found = [];
  for (const pkg of packages) {
    const expression = licenceExpression(pkg.license);
    const scope = pkg.dev ? 'tooling' : 'shipped';
    const allowed = pkg.dev ? TOOLING_ALLOWED : SHIPPED_ALLOWED;
    const exceptions = pkg.dev ? TOOLING_EXCEPTIONS : SHIPPED_EXCEPTIONS;
    const excepted = exceptions.some((e) => e.name.test(pkg.name) && e.license === expression);
    if (!excepted && (expression === undefined || !satisfies(expression, allowed))) {
      found.push({ name: pkg.name, version: pkg.version, license: expression ?? '(none)', scope });
    }
  }
  return found;
}
