// How the session travels between this browser and finapp (ADR-F02; P18-TSK-004).
//
// One port, two carriers:
//   - `cookie` (ADR-F02, the owner's decision D-D): finapp sets an HttpOnly cookie; this code never sees
//     the token. A request opts in with `X-Finapp-Session-Carrier: cookie`. Needs finapp gap G-04.
//   - `memory` (ADR-C131's carrier, the fallback): the token is held in this module's memory only and
//     sent as `Authorization: Bearer`. A reload or a new tab signs in again.
// Neither ever writes the token to storage, a URL, a log or telemetry (ADR-F07).
//
// The carrier is chosen at build time (VITE_SESSION_CARRIER). Until finapp ships G-04 the default is
// `memory`; switching is a configuration change, not a code change.

export type CarrierKind = 'cookie' | 'memory';

/** What a sign-in, a step-up or a password change returns: a token (memory carrier only) and its bounds. */
export interface IssuedSession {
  sessionToken?: string | undefined;
  assurance?: string | undefined;
  expiresAt?: string | undefined;
}

export interface SessionCarrier {
  readonly kind: CarrierKind;
  /** Adds the session to an outgoing request (or the opt-in header the cookie carrier needs). */
  decorate(headers: Headers): void;
  /** Takes up a session finapp just issued or rotated. Throws when the issue is unusable for this carrier. */
  accept(issued: IssuedSession): void;
  /** Forgets the session locally. */
  clear(): void;
}

export const SESSION_CARRIER_HEADER = 'X-Finapp-Session-Carrier';

export function memoryCarrier(): SessionCarrier {
  let token: string | undefined;
  return {
    kind: 'memory',
    decorate(headers) {
      headers.delete(SESSION_CARRIER_HEADER);
      if (token === undefined) headers.delete('Authorization');
      else headers.set('Authorization', `Bearer ${token}`);
    },
    accept(issued) {
      const next = issued.sessionToken;
      if (next === undefined || next.trim() === '') {
        throw new Error('finapp issued a session without a token, but this build carries the token in memory.');
      }
      // One assignment: no request can observe a half-rotated session (ADR-0030 rotation).
      token = next;
    },
    clear() {
      token = undefined;
    },
  };
}

export function cookieCarrier(): SessionCarrier {
  return {
    kind: 'cookie',
    decorate(headers) {
      // Never both carriers on one request: finapp refuses that (ADR-F02 decision 5).
      headers.delete('Authorization');
      headers.set(SESSION_CARRIER_HEADER, 'cookie');
    },
    accept() {
      // The token, if finapp sent one anyway, is deliberately not kept: the HttpOnly cookie carries it.
    },
    clear() {
      // The cookie is HttpOnly; only finapp clears it (DELETE /v1/sessions/current answers Max-Age=0).
    },
  };
}

function configuredKind(): CarrierKind {
  const value: unknown = import.meta.env?.['VITE_SESSION_CARRIER'];
  return value === 'cookie' ? 'cookie' : 'memory';
}

let carrier: SessionCarrier = configuredKind() === 'cookie' ? cookieCarrier() : memoryCarrier();

export function sessionCarrier(): SessionCarrier {
  return carrier;
}

/** Test-only: swap the carrier. */
export function setCarrierForTests(next: SessionCarrier): void {
  carrier = next;
}
