# ADR-F02 — The customer session carried in an HttpOnly cookie on the public surface, with a CSRF defence

Status: Accepted - adopted by `finapp` as ADR-0156 (`X-TSK-029`, 2026-11-20), as `__Host-fa_session; Path=/` (see "Adopted" below)

Date: 2026-11-19

Phase: 18

Rests on: ADR-0030, ADR-0032, ADR-0147, ADR-C131; the owner's decision D-D (`CUSTOMER_APP_BLUEPRINT.md` §12.2, §20, approved
2026-11-19); gap G-04; `P18-DOC-001`.

> **This ADR changes `finapp`.** It is written here so the customer application's record is whole. It amends ADR-0030 and
> takes effect only when `finapp` adopts it in its own register under its own number (`FINAPP_BACKEND_WORK.md` B0.2, B1.1).

## Context

ADR-0030 makes the session an opaque token judged in PostgreSQL on every request: idle 30 minutes, absolute 12 hours, rotated
on login, step-up and password change, revocable at once. Today the token travels in the JSON body of
`POST /v1/authentications` and `POST /v1/authentications/mfa`, and every request carries it as `Authorization: Bearer`
(`app/.../session/SessionAuthenticationInterceptor.java`).

ADR-0032 rejected JWT and an external identity provider. There is no cookie, and so no CSRF surface; `finapp`'s semgrep rule
`finapp-spring-csrf-disabled` says a session cookie carrying authority needs a recorded decision.

The console holds the token in memory (ADR-C131): a reload or new tab signs in again. That is acceptable for staff with a
12-hour session. For consumers, being signed out by a reload, a new tab or a link opened from an e-mail is not.

Any token readable by JavaScript can be stolen by injected script and used from elsewhere until it expires.

## Decision

1. **On the `public` surface only**, the session token may travel in a cookie:
   `fa_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/v1` (name final at implementation). No `Domain` attribute.
   No `Max-Age`; the server's idle and absolute bounds stay the only expiry.
2. **The cookie is issued** by the responses that issue a token today: sign-in, step-up, password change. A request opts in
   with a header (proposed `X-Finapp-Session-Carrier: cookie`); the JSON body then omits `sessionToken`. A request without
   it is answered exactly as today, so the console and future native clients are unchanged.
3. **Rotation replaces the cookie** wherever ADR-0030 rotates the token. Sign-out (`DELETE /v1/sessions/current`) and
   revocation of the current session clear it.
4. **CSRF defence on every unsafe method carried by the cookie**:
   - `SameSite=Strict`;
   - a required custom header (proposed `X-Finapp-Request: 1`), which a cross-site form cannot send and a cross-origin
     script cannot send without a CORS preflight that `finapp` never grants;
   - an `Origin` check against the public origin; a missing or foreign `Origin` is refused.
   A refusal is a uniform `403` problem document with a code of its own (proposed `identity.CsrfRejected`).
5. **Precedence.** If both a bearer header and the cookie are present, the request is refused (no ambiguity about which
   session acts).
6. **The operator surface never accepts the cookie.** The console keeps ADR-C131's in-memory token.
7. **Nothing else changes.** Sessions stay in PostgreSQL, judged per request; assurance levels, step-up by rotation, lockout,
   rate limits and revocation are untouched.

## Alternatives Considered

### Option A — the token in JavaScript memory (as ADR-C131)
Pros: no backend change.
Cons: a reload or new tab signs the customer out; XSS can read the token. Kept as the fallback if `finapp` declines this ADR.

### Option C — a BFF holding the session
Rejected in ADR-F01.

### Token in `localStorage` / `sessionStorage`
Rejected outright: readable by any injected script and persistent.

## Consequences

Positive: the token never reaches JavaScript; sessions survive reload and new tabs; revocation unchanged.
Negative: a CSRF surface exists and must be tested; XSS can still ride the session while the page is open (ADR-F07's CSP is the
control).
Operational impact: none beyond the interceptor and response changes; no new store.
Security impact: removes token exfiltration by script; adds CSRF tests (cross-site form, cross-origin fetch, missing header,
foreign `Origin`) to `finapp`'s security suite; the semgrep baseline records the decision.
Financial impact: none.

## Invariants / Constraints

- ADR-0030's revocation property: a revoked session is refused at the next request on every replica.
- The token never appears in a URL, a log, a trace, a metric or an analytics event.
- The cookie is never accepted on the operator surface.

## Follow-up

- `finapp` assigns this decision a number in its own register and implements it (G-04, Stage 2's hard dependency).
- If declined, Stage 2 ships with option A and the sign-out-on-reload cost is recorded in `PHASE_18_PLAN.md`.

## Adopted (2026-11-20)

`finapp` adopted this decision as **ADR-0156** (`X-TSK-029`), pulled forward from Phase 18 on the owner's word. Two details were
settled at implementation, as decision 1 allowed: the cookie is `__Host-fa_session` with `Path=/` (the `__Host-` prefix stops a
sibling host or a plain-HTTP response planting or overwriting it; a path is no boundary within one origin), and the CSRF custom
header is `X-Finapp-Request: 1`, which this application's client already sends on every request. The allowed origins are
`finapp`'s `FINAPP_SESSION_COOKIE_ALLOWED_ORIGINS`; locally they default to `http://localhost:5180` and `:4180`. The dev server
selects the cookie carrier and marks its proxied requests `X-Finapp-Surface: public` (`vite.config.ts`); on start-up the
application restores a live session from `GET /v1/sessions` (`restoreSession`).
