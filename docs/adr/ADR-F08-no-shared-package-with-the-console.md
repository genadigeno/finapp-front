# ADR-F08 — No shared package with the Operator Console yet

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: ADR-C130, ADR-C136, ADR-F03; `CUSTOMER_APP_BLUEPRINT.md` §2.2; `P18-DOC-001`.

## Context

The console (`finapp-admin-panel`) already has a money formatter, an API error model, an idempotency helper, lint guards, a
contract pin and a CSP catalogue. The customer application needs the same kinds of things, but for a different audience
(consumer language and touch targets), a different session carrier (ADR-F02 vs ADR-C131), and a different set of operations.
The console is mid-phase and changes quickly.

## Decision

1. **No shared package now.** The customer application re-implements its platform and value components, **modelled on** the
   console's, in its own repository.
2. **Copy by reading, not by importing.** Where a console implementation is reused, it is reviewed and adapted here, and its
   origin noted in a comment.
3. **Revisit** when both applications reach a stable stage (console exit review; customer Stage 4), with candidates: the
   problem-code catalogue, the money formatter, the contract pin scripts, the lint guard rules.

## Alternatives Considered

### A shared npm workspace or package now
Pros: one implementation. Cons: couples two release cadences and two design languages before either is stable; a publishing
pipeline to own.

## Consequences

Positive: each application moves at its own pace.
Negative: some duplication, and fixes must be carried by hand both ways for a while.
Operational impact: none. Security impact: none. Financial impact: none.

## Invariants / Constraints

- The two applications never share a session or a deployable.

## Follow-up

- Revisit at Stage 4 exit.
