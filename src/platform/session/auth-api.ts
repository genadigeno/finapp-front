// The customer's own session doors on finapp's public surface (API_CONVENTIONS.md §8a). Adapted from
// finapp-admin-panel/src/platform/session/auth-api.ts (ADR-F08). The screens over these doors are Stage 2
// (P18-TSK-010, -012); Stage 1 provides the doors and the session state they feed.
import { ApiError } from '../api/api-error.ts';
import { ok, type FinappClient } from '../api/client.ts';
import { acceptIssuedSession, endSession } from './session-store.ts';

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
