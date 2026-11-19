# ADR-F05 — Command handling: one idempotency intent per review, unknown-outcome reconciliation, no optimistic financial UI

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: `API_CONVENTIONS.md`, `ERROR_CONTRACT.md`, X-TSK-003, `CUSTOMER_APP_BLUEPRINT.md` §11.1, §13; `P18-DOC-001`.

## Context

Money-moving commands require `Idempotency-Key`. `finapp` answers a missing key with `422 api.IdempotencyKeyRequired`, a
reused key with a different body with `409 api.Conflict`, a key still in flight with `409 api.IdempotencyInProgress`, and a
replay with the original response. Keys are scoped per principal (X-TSK-003). A request can time out after the backend has
committed. Some commands are asynchronous (202, then a status to poll). Step-up (`403 identity.AssuranceRequired`) interrupts a
command and must be answered before it is sent again.

## Decision

1. **One `IdempotencyIntent` per review screen.** The key is minted when the customer reaches review, and the request body is
   frozen there. Every send of that review (double click, retry, replay after step-up, reconciliation) uses the same key and
   the same body. Editing the form discards the intent.
2. **Commands are never retried automatically**, except:
   - after a successful step-up, replayed **once** with the same key;
   - after `409 api.IdempotencyInProgress` or `503` with `Retry-After`, re-sent with the same key.
3. **A timeout or network loss after send is an unknown outcome**, a state of its own, not a failure. The screen says that
   nothing should be re-entered, and reconciles by re-sending the same key; the replay returns the original result.
4. **`409 api.Conflict` on the same key** is a client defect: shown, reported, never resolved automatically.
5. **No optimistic financial UI.** A balance, status or list changes only when the backend reports it. Submit controls disable
   on first submit.
6. **Asynchronous outcomes** show a status page that polls with bounded backoff, stops at a terminal state and resumes on
   focus. `HELD` and `FAILED` show no reason (`INV-RSK-08`).
7. **Freshness in the body** (`expiresAt` of a quote, `termsSha256`, payoff quotes): at expiry the confirm control disables;
   stale codes (`fx.QuoteExpired`, `*.TermsChanged`, `*.PayoffQuoteStale`, `*.PolicyStale`, `credit.DataStale`) lead to
   re-read and re-review, never auto-acceptance.
8. **After any command**, balances and affected lists are invalidated in every tab (`BroadcastChannel`); data is never sent
   between tabs.

## Alternatives Considered

### A key per HTTP attempt
Cons: a retry after a lost response executes twice.

### Persisting the intent in storage to survive a closed tab
Cons: stores amounts and beneficiaries at rest (ADR-F07). Instead, the customer is directed to the operation list, which is
why list endpoints (G-01, G-02) matter.

## Consequences

Positive: one operation per customer intent; honest pending and unknown states.
Negative: a closed tab loses the in-memory intent; recovery relies on lists.
Operational impact: none. Security impact: none. Financial impact: prevents duplicate movements from the client side.

## Invariants / Constraints

- One customer intent, at most one ledger effect.
- No client-side state transition of a financial object.

## Follow-up

- E2E scenarios 2, 5, 6, 7, 9, 11 (`CUSTOMER_APP_BLUEPRINT.md` §17) prove this decision against a real `finapp`.
