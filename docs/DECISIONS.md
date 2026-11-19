# Decisions — Customer Application

The human-readable index of what was decided for the Customer Application; the reasoning is in [`adr/`](adr/README.md).
`finapp`'s own record (`finapp/docs/project/DECISIONS.md`) is unchanged.

## Phase 18, `Proposed` by `P18-DOC-001` ahead of the phase opening

Planned in [`PHASE_18_PLAN.md`](PHASE_18_PLAN.md), a draft until the Phase 18 entry gate (`P18-INIT`). The architecture is
[`CUSTOMER_APP_BLUEPRINT.md`](CUSTOMER_APP_BLUEPRINT.md). The phase's ADRs are ADR-F01…ADR-F08; **the next free number is
ADR-F09.** This register is its own (`ADR-F…`); a plain `ADR-NNNN` is `finapp`'s and an `ADR-C…` is the console's.

**D-A…D-H (the owner, 2026-11-19: "Approve all").** The eight decisions of the blueprint's §20 are decided at their
recommendations:

| # | Decision | → |
|---|---|---|
| D-A | The Customer Application is **Phase 18** of the `finapp` programme, governed in this repository (plan, backlog `P18-…`, ADRs `ADR-F…`, DoD). Stage 1 (Foundation) proceeds before the phase opens, in this repository only, under a **pre-phase allowance** like the console's D-1. `finapp`'s phases, tasks and statuses are untouched. | `PHASE_18_PLAN.md` §2 |
| D-B | This directory is the `finapp-front-end` git repository. | ADR-F01 |
| D-C | One application for individuals and business registrants. | ADR-F01, ADR-F06 |
| D-D | The session is carried in an HttpOnly cookie issued by the monolith on the public surface, with a CSRF defence (option B). Needs `finapp` to adopt ADR-F02 and implement G-04; the fallback is the in-memory token (option A). | ADR-F02 |
| D-E | No backend-for-frontend and no gateway; gaps close in owning modules. | ADR-F01 |
| D-F | The stack of the blueprint's §8: Vite, React, TypeScript, Mantine 9, TanStack; React Aria + Tailwind as the fallback. | ADR-F03 |
| D-G | G-04, G-15 and G-03 are P0 for `finapp`, to be scheduled there by the owner. | `FINAPP_BACKEND_WORK.md` |
| D-H | Card issuing, investments, scheduled payments, notifications and support are excluded until backend capabilities exist. | `PHASE_18_PLAN.md` §1 |

ADR-F04…F08 record the blueprint's engineering decisions (money, commands, standing, hardening, no shared package) that the
approval carried with it.
