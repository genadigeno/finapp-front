// Adapted from finapp-admin-panel/scripts/lib/contract.mjs (ADR-F08: copied by reading, not shared).
import { createHash } from 'node:crypto';

export const CONTRACT_PATH_IN_FINAPP = 'docs/api/openapi.json';
export const CONTRACT_FILE = 'contract/openapi.json';
export const SOURCE_FILE = 'contract/SOURCE.json';
export const GENERATED_FILE = 'src/generated/finapp-api.ts';

/** @param {string | Buffer} content */
export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * The pin is intact when the committed contract is byte-for-byte the one SOURCE.json names.
 * @param {string} contract the contract file's content
 * @param {{ sha256?: unknown, commit?: unknown }} source SOURCE.json's content
 * @returns {string[]} violations; empty is a pass
 */
export function pinProblems(contract, source) {
  /** @type {string[]} */
  const found = [];
  if (typeof source.commit !== 'string' || !/^[0-9a-f]{40}$/.test(source.commit)) {
    found.push('SOURCE.json does not name a full finapp commit');
  }
  if (source.sha256 !== sha256(contract)) {
    found.push(
      `${CONTRACT_FILE} does not match the sha256 SOURCE.json records - it was edited by hand or pulled without updating the pin`,
    );
  }
  return found;
}
