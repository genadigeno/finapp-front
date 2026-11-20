// The TanStack Query client, wired to the ONE read retry policy (blueprint §11.1). Adapted from
// finapp-admin-panel/src/platform/query/query-client.ts (ADR-F08).
//
// Reads retry on transient failures with jittered backoff; mutations - commands - never retry on their own
// (the command runner owns the few same-key re-sends ADR-F05 allows). Data lives in memory only: no
// persistence plugin, no service worker (ADR-F07 decision 4).
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/api-error.ts';
import { retryDelayMs, shouldRetry } from '../api/retry-policy.ts';

export interface QueryClientOptions {
  /** Called when any read or command answers 401: the session is gone. */
  onUnauthenticated?: () => void;
  /** Called with every failed read or command, after the retry policy has given up on a read. */
  onFailure?: (error: unknown) => void;
}

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const onError = (error: unknown) => {
    options.onFailure?.(error);
    if (error instanceof ApiError && error.isUnauthenticated) options.onUnauthenticated?.();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // TanStack passes the failures BEFORE this one (0 after the first); the policy counts them including it.
        retry: (failuresBefore, error) => shouldRetry(failuresBefore + 1, error),
        retryDelay: (failuresBefore) => retryDelayMs(failuresBefore + 1),
        // Balances and statuses are point-in-time: stale at once, re-read on focus (ADR-F05; blueprint §16).
        refetchOnWindowFocus: true,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  });
}

/**
 * For a page about one thing whose status finapp can still change - a payment, a withdrawal, a loan, a credit check,
 * a receipt (D-R WP-6). Nothing is kept once the page is left, so coming back shows a loading state and then finapp's
 * answer, never an older one first: a later reversal, refund or closure must not be preceded by a stale "paid".
 */
export const FRESH_ON_VIEW = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

/**
 * Re-reads every query under the given roots - in this tab, and (through the cross-tab channel the caller
 * passes) in every other tab. Never carries data between tabs (ADR-F05 decision 8).
 */
export async function invalidateRoots(
  client: QueryClient,
  roots: readonly string[],
  broadcast?: (roots: readonly string[]) => void,
): Promise<void> {
  broadcast?.(roots);
  await Promise.all(roots.map((root) => client.invalidateQueries({ queryKey: [root] })));
}
