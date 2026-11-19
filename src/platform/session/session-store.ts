// The customer's session as this application knows it (ADR-0030; ADR-F02; P18-TSK-004).
// Adapted from finapp-admin-panel/src/platform/session/session-store.ts (ADR-F08).
//
// The token belongs to the carrier (carrier.ts) and never appears here. This store holds only what
// screens need - signed in or not, the assurance, the bounds, the last activity - none of it secret,
// none of it persisted. The server is the authority on every bound: these are for warnings only.
import { sessionCarrier, type IssuedSession } from './carrier.ts';

export type Assurance = 'PASSWORD' | 'MULTI_FACTOR' | 'STRONG';

export type SignedOutReason = 'expired' | 'signed-out' | 'revoked' | 'elsewhere';

export type SessionState =
  | { status: 'signed-out'; reason?: SignedOutReason }
  | {
      status: 'signed-in';
      assurance: Assurance;
      /** The idle bound finapp reported with the session, extended locally on activity. */
      idleExpiresAt: number;
      lastActivityAt: number;
    };

/** finapp's idle bound (SessionPolicy: 30 minutes), mirrored only to warn before it bites. */
export const IDLE_TIMEOUT_MS = 30 * 60_000;

let state: SessionState = { status: 'signed-out' };
const listeners = new Set<() => void>();

function publish(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

export function sessionState(): SessionState {
  return state;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toAssurance(value: string | undefined): Assurance {
  return value === 'MULTI_FACTOR' || value === 'STRONG' ? value : 'PASSWORD';
}

/**
 * Starts or ROTATES the session in one step: the carrier takes the new token before the state is
 * published, so no request can go out with a new state and an old token.
 */
export function acceptIssuedSession(issued: IssuedSession, now: number = Date.now()): void {
  const expiresAt = issued.expiresAt === undefined ? Number.NaN : Date.parse(issued.expiresAt);
  if (Number.isNaN(expiresAt)) throw new Error('finapp issued a session without a readable expiry.');
  sessionCarrier().accept(issued);
  publish({
    status: 'signed-in',
    assurance: toAssurance(issued.assurance),
    idleExpiresAt: expiresAt,
    lastActivityAt: now,
  });
}

/** Every authenticated response extends the idle bound server-side; mirror it for the warning. */
export function recordActivity(now: number = Date.now()): void {
  if (state.status === 'signed-in') {
    publish({ ...state, lastActivityAt: now, idleExpiresAt: Math.max(state.idleExpiresAt, now + IDLE_TIMEOUT_MS) });
  }
}

/** Forgets the session locally. Callers that sign out also tell finapp (DELETE /v1/sessions/current). */
export function endSession(reason: SignedOutReason): void {
  sessionCarrier().clear();
  publish({ status: 'signed-out', reason });
}
