// Where to go after signing in (ADR-F07 decision 7: no open redirect).
//
// A `returnTo` is honoured only when it is EXACTLY one of the application's own static paths below. It is
// never a URL, never a path with an identifier (which could point a customer at something chosen by a
// third party's link), and never followed off this origin. Each stage adds the paths of its pages.

export const RETURNABLE_PATHS: ReadonlySet<string> = new Set(['/home']);

export const DEFAULT_SIGNED_IN_PATH = '/home';

/** The validated return path, or undefined when the value is anything but an allow-listed path. */
export function validReturnTo(value: unknown): string | undefined {
  return typeof value === 'string' && RETURNABLE_PATHS.has(value) ? value : undefined;
}
