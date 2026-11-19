// Adapted from finapp-admin-panel/src/design-system/use-now.ts (ADR-F08).
import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs`. Rendering stays pure (no Date.now() in a render
 * body), and time-dependent text - "stale", "3 minutes ago" - updates on its own as time passes.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
