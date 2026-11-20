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

**D-I (the owner, 2026-11-19: "Start Stage 2").** Stage 2 (identity and onboarding) begins ahead of the Phase 18
entry gate, as the console's M2-M11 did (console D-13...D-23): this repository builds the screens over the doors
`finapp` already serves (sign-in, registration, MFA, sessions, consents, KYC, organisation and KYB), with the
in-memory session carrier until `finapp` ships G-04. What only `finapp` can do stays in
[`FINAPP_BACKEND_WORK.md`](FINAPP_BACKEND_WORK.md) (B1.1-B2.3); `finapp` is not changed from here. Screens whose
backend is missing (password recovery and contact verification, G-03) are not built. -> `PHASE_18_PLAN.md` §4.2

**D-K (the owner, 2026-11-19: "Start Stage 3").** Stage 3 (core banking: wallets, balances, statements, history)
begins as Stage 2 did: frontend only, over the doors `finapp` serves today, degrading honestly where lists and the
activity read are missing (G-01, G-02). `finapp` is not changed from here. D-J (a QR library) stays open.
-> `PHASE_18_PLAN.md` §4.3

**D-L (the owner, 2026-11-19: "Start Stage 4, always commit changes").** Stage 4 (money movement: beneficiaries,
internal transfers, payment methods and top-up, withdrawals, FX, cross-border, receipts) begins as Stage 3 did:
frontend only, over the doors `finapp` serves today. Work is committed to this repository as each stage completes,
without a separate request. -> `PHASE_18_PLAN.md` §4.4

**D-M (the owner, 2026-11-19: "Start Stage 5").** Stage 5 (credit: credit checks, loans and credit lines, pay later,
paying a shop) begins as Stage 4 did: frontend only, over the doors `finapp` serves today, committed when complete.
Within it, two engineering choices the owner may revisit: the checkout code is typed in on the page (finapp has no
hand-over that keeps it out of URLs, G-20), and the Credit entry is always in the main navigation (the navigation is
static per route; the blueprint shows it only to customers with credit). -> `PHASE_18_PLAN.md` §4.5

**D-N (the owner, 2026-11-19: "Start Stage 6").** Stage 6 (self-service: security centre, password, details,
consents) begins as Stage 5 did: frontend only, over the doors `finapp` serves today, committed when complete.
Notifications and support are not built - `finapp` provides neither (`P18-TSK-035` is conditional on it). The
details page is reached from the security centre rather than a new navigation entry (seven already fill a phone's
bar). -> `PHASE_18_PLAN.md` §4.6

**D-O (the owner, 2026-11-19: "Start Stage 7").** Stage 7 (production readiness) is done as far as this repository can
take it: frontend only, `finapp` unchanged. The performance budgets are measured with the existing Playwright and
Edge/Chromium tooling on a throttled phone profile rather than by adding Lighthouse CI (a new dependency and browser
download, for the owner to approve if wanted). The threat model is drafted here for `finapp` to adopt. The ZAP
baseline and penetration test wait for staging (G-15); the manual screen-reader passes wait for a person.
-> `PHASE_18_PLAN.md` §4.7

**D-P (the owner, 2026-11-20: "make front end app more beautiful for users, keep finance and accounting, and fintech
theme and dont use annoying styles, formatting and colors. cover all pages").** A visual refresh of the whole
application through the design system - theme, generated theme stylesheet and global stylesheet - plus the start,
sign-in and registration layouts. A muted navy and slate palette, cards on a soft canvas, ledger tables; no new
dependency, no web font, no animation beyond Mantine's own, no change to wording, behaviour or requests. Colour
keeps its one job: status. -> `PHASE_18_PLAN.md` §4.8

**D-Q (the owner, 2026-11-20: "i like it. keep this style. only sharp corners on buttons and divs").** The D-P look
stays, with square corners: the theme's radius scale is zero, so buttons, inputs, cards, badges, alerts and dialogs
are all square; the logo mark and the wizard's step numbers follow. Radio buttons stay round (a convention people
read as "pick one"). -> `PHASE_18_PLAN.md` §4.8
