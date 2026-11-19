// Where to go after signing in (ADR-F07 decision 7: no open redirect).
// (Moved from src/app by P18-TSK-010, so the sign-in page in its module can read it.)
//
// A `returnTo` is honoured only when it is EXACTLY one of the application's own static paths that a route
// marks `returnable`. It is never a URL, never a path with an identifier (which could point a customer at
// something chosen by a third party's link), and never followed off this origin.

import { useRouterState } from '@tanstack/react-router';

export const DEFAULT_SIGNED_IN_PATH = '/home';

let returnable: ReadonlySet<string> = new Set([DEFAULT_SIGNED_IN_PATH]);

/** Set once, from the routes marked returnable (src/app/route-table.ts). */
export function setReturnablePaths(paths: Iterable<string>): void {
  returnable = new Set([DEFAULT_SIGNED_IN_PATH, ...paths]);
}

/** The validated return path, or undefined when the value is anything but an allow-listed path. */
export function validReturnTo(value: unknown): string | undefined {
  return typeof value === 'string' && returnable.has(value) ? value : undefined;
}

/**
 * The validated return path for the sign-in page. TanStack merges every route's search with the raw query
 * string, so a page must never read `returnTo` from the search directly: it reads it here, where it is
 * validated at the point of use.
 */
export function useReturnTo(): string | undefined {
  const raw = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)['returnTo'] });
  return validReturnTo(raw);
}
