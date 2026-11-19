// Following an asynchronous outcome (ADR-F05 decision 6; blueprint §13): a status page re-reads the operation
// with a bounded backoff, stops at a terminal status, and resumes when the customer returns to the tab (TanStack
// refetches on focus). It never decides an outcome itself - it only asks again.

/** 2 s, then 4, 8, 15, and every 30 s after that. */
const STEPS_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const;

/** The delay before the next read, by how many reads have already been made. */
export function backoffMs(reads: number): number {
  return STEPS_MS[Math.min(reads, STEPS_MS.length - 1)] ?? 30_000;
}

/**
 * A `refetchInterval` for TanStack Query: off once the status is terminal, otherwise the backoff by the number of
 * reads so far (`dataUpdateCount`).
 */
export function pollUntil<T>(isTerminal: (data: T) => boolean) {
  return (query: { state: { data: T | undefined; dataUpdateCount: number } }): number | false => {
    const data = query.state.data;
    if (data !== undefined && isTerminal(data)) return false;
    return backoffMs(query.state.dataUpdateCount);
  };
}
