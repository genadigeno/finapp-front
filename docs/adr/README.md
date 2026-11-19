# Architecture Decision Records — Customer Application

The Customer Application's decisions. The human-readable summary is [`../DECISIONS.md`](../DECISIONS.md).

## Rules

- One decision per ADR, in `finapp`'s template (`finapp/docs/adr/ADR_TEMPLATE.md`).
- Status: `Proposed` → `Accepted` → `Superseded`. An accepted ADR is never edited to change its decision; a new ADR
  supersedes it. A `Proposed` ADR may be corrected in place, with a dated note saying what it first read.
- **Numbering.** These ADRs are numbered `ADR-F…`, a register of their own, as the console's are `ADR-C…`.
  - A plain `ADR-NNNN` cited here is always `finapp`'s, in `finapp/docs/adr/`.
  - An `ADR-C…` is the Operator Console's, in `finapp-admin-panel/docs/adr/`.
  - Unqualified architecture documents (`API_CONVENTIONS.md`, `ERROR_CONTRACT.md`, `THREAT_MODEL.md`, …) are `finapp`'s.
  - **The next free number is ADR-F09.**
- ADR-F01…F08 were written `Proposed` by `P18-DOC-001` (2026-11-19), after the owner approved decisions D-A…D-H of the
  blueprint ("Approve all"). They become `Accepted` at the Phase 18 entry gate (`P18-INIT`), as the console's did not
  before Phase 17 opened.
- **ADR-F02 changes `finapp`.** It is proposed here so the customer application's record is complete; it takes effect
  only when `finapp` adopts it in its own register (`FINAPP_BACKEND_WORK.md` B0.2).

## Index

| ADR | Title | Status | Phase | Concern |
|-----|-------|--------|-------|---------|
| [F01](ADR-F01-the-customer-application.md) | The Customer Application: a separate single-page application, served same-origin from the public edge, with no backend-for-frontend | Proposed | 18 | Platform · Public edge · every customer-facing module |
| [F02](ADR-F02-cookie-session-carrier-on-the-public-surface.md) | The customer session carried in an HttpOnly cookie on the public surface, with a CSRF defence | Proposed | 18 | Identity · Public edge · Security (**changes `finapp`**) |
| [F03](ADR-F03-the-customer-frontend-stack.md) | The customer frontend stack: Vite, React and TypeScript on Mantine with TanStack, no template, no paid dependency | Proposed | 18 | Customer Application · Supply chain |
| [F04](ADR-F04-money-rates-and-dates-in-the-browser.md) | Money, rates and dates in the browser: strings in, `Intl` out, no arithmetic | Proposed | 18 | Customer Application · Financial correctness |
| [F05](ADR-F05-command-handling-and-the-unknown-outcome.md) | Command handling: one idempotency intent per review, unknown-outcome reconciliation, no optimistic financial UI | Proposed | 18 | Customer Application · Financial correctness |
| [F06](ADR-F06-customer-standing-drives-navigation.md) | Customer standing drives navigation; authorization stays the backend's | Proposed | 18 | Customer Application · Identity · Party |
| [F07](ADR-F07-browser-hardening-and-telemetry.md) | Browser hardening: a strict CSP with Trusted Types, a storage policy, an allow-listed telemetry schema | Proposed | 18 | Customer Application · Security · Privacy |
| [F08](ADR-F08-no-shared-package-with-the-console.md) | No shared package with the Operator Console yet | Proposed | 18 | Customer Application · Operator Console |
