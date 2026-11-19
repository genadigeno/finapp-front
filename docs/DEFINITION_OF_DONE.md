# Definition of Done — Customer Application

The Customer Application's work is held to `finapp`'s Definition of Done (`finapp/docs/project/DEFINITION_OF_DONE.md`): its
thirteen dimensions (§1.1–§1.13, cited below by number) and its anti-patterns (§3) bind here. Backend tasks carry `finapp`'s
own profiles (`DOD-API`, `DOD-SEC`, `DOD-FIN`, …). Frontend tasks carry `DOD-CUST`. The console's `DOD-UI`
(`finapp-admin-panel/docs/DEFINITION_OF_DONE.md`) is its model.

## `DOD-CUST` — the Customer Application (frontend)

Dimensions 1.8 (security), 1.11 (observability: the correlation reference surfaced on every outcome), 1.12 (testing),
1.13 (documentation). Plus:

- **No money arithmetic in the client** (ADR-F04). Amounts stay decimal strings with their currency; a lint rule, proven to
  fail by a guard test, prevents floating-point conversion.
- **No business rule, eligibility or state transition decided in the client.**
- **No session token reachable by script, and none at rest** (ADR-F02; until G-04, memory only as ADR-C131).
- **Every command path** uses one idempotency intent per review, handles the unknown outcome, and is never auto-retried
  beyond ADR-F05's cases.
- **The production CSP with Trusted Types is intact**; the catalogue and E2E runs record zero violations (ADR-F07).
- **No persistent browser storage** except the allow-listed preferences key; no API data in a URL.
- **Telemetry** carries only allow-listed fields; a spy-transport test proves no token, amount or personal data leaves.
- **axe** reports no serious or critical finding on changed routes in light and dark themes; keyboard paths and focus
  management are tested; touch targets are at least 44 px.
- **No mock data outside tests**; MSW never reaches `dist/`.
- **No screen claims a capability whose endpoint is missing**; every screen is backed by a real customer endpoint,
  exercised end to end against a running `finapp` from Stage 2 on.
- **Customer wording**: every problem `code` the screen can receive maps to a message and a next step; no internal code is
  shown except the correlation reference.

## Stage 1 acceptance

The eleven items of `CUSTOMER_APP_BLUEPRINT.md` §22 are Stage 1's exit criteria; `PHASE_18_PLAN.md` §4 maps each to the task
that delivers it.

*(Written by `P18-DOC-001`, 2026-11-19, after the owner's "Approve all" of D-A…D-H. It binds every Phase 18 frontend task,
including those D-A lets proceed before the phase opens.)*
