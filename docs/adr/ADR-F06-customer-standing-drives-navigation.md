# ADR-F06 — Customer standing drives navigation; authorization stays the backend's

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: ADR-0031, X-TSK-002 (`OwnershipIsScopedTest`), `INV-RSK-08`, `CUSTOMER_APP_BLUEPRINT.md` §12.5; the owner's
decision D-C; gaps G-08, G-09; `P18-DOC-001`.

## Context

Customers hold no roles. The backend authorizes every customer request by its RBAC boundary plus an ownership check, and answers
"not yours" with a uniform `404`. What a customer can do depends on standing: party kind (`PERSON`, `ORGANISATION`), customer
status, KYC or KYB status, MFA enrolment, consent state and product availability (`ProductNotOffered` in production for credit,
lending and BNPL). Customer status is not yet exposed on `GET /v1/me` (G-08). An organisation has one acting person, its
registrant; there are no members or mandates (G-09).

## Decision

1. **Navigation and gating are derived from standing read from the backend** (`GET /v1/me` and the owning reads), never from
   local state or from what the client last saw.
2. **Hiding a control is UX only.** Every operation is authorized by the backend; the client never decides that an action is
   allowed.
3. **A refusal re-reads standing.** `401` routes to sign-in with a validated return route; `403 api.Forbidden` and a
   `404` on a resource the customer had open refresh standing and re-route; nothing is retried blindly.
4. **Identifiers in URLs are opaque.** Knowing an identifier grants nothing; a `404` is shown as a generic "not found".
5. **Risk and AML data are never shown** (`INV-RSK-08`); KYC shows the customer-shaped status only.
6. **Business**: the registrant sees organisation registration and KYB. No "act as organisation" until `finapp` introduces
   mandates (G-09).
7. **Until G-08 lands**, routing uses what `GET /v1/me` and the KYC and consent reads already return, and the onboarding
   checklist says only what those reads support.

## Alternatives Considered

### Client-side role model
Cons: customers hold no roles; a client model would drift from the backend's and invite trusting it.

## Consequences

Positive: one source of authorization; standing changes (suspension, revoked session) take effect at the next call.
Negative: an extra read at start-up; some gating is coarse until G-08.
Operational impact: none. Security impact: no authority in the browser. Financial impact: none.

## Invariants / Constraints

- No screen implies an operation is permitted because its control is visible.

## Follow-up

- E2E scenarios 1, 3, 4, 12, 13 (`CUSTOMER_APP_BLUEPRINT.md` §17).
