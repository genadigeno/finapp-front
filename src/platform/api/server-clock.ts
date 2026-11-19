// The difference between the server's clock and this device's (ADR-F05 decision 7).
//
// A quote's `expiresAt` is judged by the server's clock. A device whose clock runs fast would show a
// quote as expired that is still good; one that runs slow would offer to confirm an expired quote. The
// API client records the offset from each response's `Date` header; countdowns add it to `Date.now()`.
// `Date` has one-second resolution, so the offset is smoothed and never claimed to be finer than that.

let offsetMs = 0;
let samples = 0;

/** Records one observation: the server said `serverDate` when this device's clock read `localNow`. */
export function observeServerDate(serverDate: string | null, localNow: number = Date.now()): void {
  if (serverDate === null) return;
  const at = Date.parse(serverDate);
  if (Number.isNaN(at)) return;
  const observed = at - localNow;
  // A running mean over the first observations, then an exponential average: one slow response cannot
  // swing the estimate by its whole latency.
  samples = Math.min(samples + 1, 10);
  offsetMs += (observed - offsetMs) / samples;
}

/** Milliseconds to add to this device's clock to read the server's. */
export function serverOffsetMs(): number {
  return Math.round(offsetMs);
}

/** The server's "now" as best this device knows it. */
export function serverNow(localNow: number = Date.now()): number {
  return localNow + serverOffsetMs();
}

/** Test-only reset. */
export function resetServerClock(): void {
  offsetMs = 0;
  samples = 0;
}
