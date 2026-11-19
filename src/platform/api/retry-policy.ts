// The one retry policy for READS (blueprint §11.1). Adapted from
// finapp-admin-panel/src/platform/api/retry-policy.ts (ADR-F08).
//
// Reads (safe methods) are retried a bounded number of times when the failure is transient: no response,
// or a 5xx. A 4xx is an answer and is never retried. Commands are NEVER retried here: the command runner
// (command.ts) owns the few same-key re-sends ADR-F05 allows.
//
// Pure functions, so TanStack Query's `retry` and `retryDelay` take them directly - one policy, never
// two retry loops stacked on each other.
import { ApiError } from './api-error.ts';

export const MAX_READ_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

/** @param failureCount how many attempts have already failed (1 after the first failure). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (!error.isSafeMethod) return false;
  if (failureCount >= MAX_READ_ATTEMPTS) return false;
  if (error.kind === 'aborted') return false;
  if (error.kind === 'network' || error.kind === 'timeout') return true;
  return error.status !== undefined && error.status >= 500;
}

/** Exponential backoff with full jitter, capped. `random` is injectable for tests. */
export function retryDelayMs(failureCount: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, failureCount - 1));
  return Math.floor(random() * ceiling);
}
