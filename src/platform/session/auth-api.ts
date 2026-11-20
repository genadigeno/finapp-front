// The customer's own session doors on finapp's public surface (API_CONVENTIONS.md §8a). Adapted from
// finapp-admin-panel/src/platform/session/auth-api.ts (ADR-F08). The screens over these doors are Stage 2
// (P18-TSK-010, -012); Stage 1 provides the doors and the session state they feed.
import { ApiError } from '../api/api-error.ts';
import { ok, type FinappClient } from '../api/client.ts';
import { sessionCarrier } from './carrier.ts';
import { acceptIssuedSession, endSession } from './session-store.ts';

/**
 * On start-up with the cookie carrier, asks finapp whether the HttpOnly cookie still names a live session
 * (ADR-F02; finapp ADR-0156): this application cannot read the cookie, so only finapp can say. A live one is taken up
 * with the assurance and idle bound finapp reports for it; anything else - no cookie, an expired or revoked session,
 * finapp unreachable - leaves the customer signed out, as a fresh tab was before. Answers whether one was restored.
 */
export async function restoreSession(api: FinappClient): Promise<boolean> {
  if (sessionCarrier().kind !== 'cookie') return false;
  try {
    const { data } = await ok(api.GET('/v1/sessions'));
    const current = data.find((session) => session.current === true);
    if (current?.idleExpiresAt === undefined) return false;
    acceptIssuedSession({ assurance: current.assurance, expiresAt: current.idleExpiresAt });
    return true;
  } catch (error) {
    if (error instanceof ApiError) return false;
    throw error;
  }
}

export async function signIn(api: FinappClient, loginIdentifier: string, password: string): Promise<void> {
  const { data } = await ok(api.POST('/v1/authentications', { body: { loginIdentifier, password } }));
  acceptIssuedSession(data);
}

/** Proves the second factor; finapp rotates the session, taken up atomically by the carrier. */
export async function stepUp(api: FinappClient, code: string): Promise<void> {
  const { data } = await ok(api.POST('/v1/authentications/mfa', { body: { code } }));
  acceptIssuedSession(data);
}

/**
 * Signs out at finapp, then forgets the session locally EVEN IF the call fails: a customer who pressed
 * "Sign out" must not stay signed in on this screen because the network blipped.
 */
export async function signOut(api: FinappClient): Promise<void> {
  try {
    await ok(api.DELETE('/v1/sessions/current'));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  } finally {
    endSession('signed-out');
  }
}
