# Phase 18 — Customer Application

Status: `PLANNED` (2026-11-19 — **not opened**; its entry gate has not been run).

The owner's brief of 2026-11-19 asked for a customer-facing application for individuals and businesses. The blueprint answering
it ([`CUSTOMER_APP_BLUEPRINT.md`](CUSTOMER_APP_BLUEPRINT.md)) was approved the same day ("Approve all", decisions D-A…D-H). By
D-A:
- The Customer Application is Phase 18, governed in this repository. It opens through `P18-INIT`, after the owner sequences it
  behind Phases 16 and 17.
- `P18-DOC-001` wrote ADR-F01…ADR-F08 (`Proposed`), [`PHASE_18_PLAN.md`](PHASE_18_PLAN.md), this backlog,
  [`DECISIONS.md`](DECISIONS.md), [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) and
  [`FINAPP_BACKEND_WORK.md`](FINAPP_BACKEND_WORK.md).
- **`finapp`'s phases, tasks, waves and milestones are untouched.**

**What may proceed before the phase opens** (D-A): Stage 1, `P18-TSK-001`…`-009`, in this repository only. **Built 2026-11-19** (the owner's "Start Stage 1"); its record and deviations are `PHASE_18_PLAN.md` §4.1, and completion is recorded at `P18-INIT`.

**Entries:** `P18-DOC-001` is written in full. Stage 1 tasks' full fields are in `PHASE_18_PLAN.md` §4. Every other entry is
compact: stage, dependencies, gaps, DoD. `P18-INIT` elaborates them. Tasks marked *(backend)* are `finapp`'s work, described
in `FINAPP_BACKEND_WORK.md`.

| Stage | Content |
|---|---|
| 0 | Discovery and decisions |
| 1 | Foundation |
| 2 | Identity and onboarding |
| 3 | Core banking |
| 4 | Money movement |
| 5 | Credit |
| 6 | Self-service |
| 7 | Production readiness |

---

## Stage 0 — Discovery

### `P18-DOC-001` — Blueprint, decisions and Phase 18 records
- **Status:** `COMPLETE` (2026-11-19)
- **Delivered:** `CUSTOMER_APP_BLUEPRINT.md` (22 deliverables); owner decisions D-A…D-H; ADR-F01…F08 (`Proposed`);
  `PHASE_18_PLAN.md`; this backlog; `DECISIONS.md`; `DEFINITION_OF_DONE.md` (`DOD-CUST`); `FINAPP_BACKEND_WORK.md`;
  the repository initialised (D-B).
- **Changed in `finapp`:** nothing.
- **DoD:** 1.13.

## Stage 1 — Foundation (pre-phase allowance)

| Task | Title | Depends on | Gaps | DoD | Status |
|---|---|---|---|---|---|
| `P18-TSK-001` | Repository, toolchain and supply-chain gates | DOC-001 | — | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-002` | Contract pin and generated types | 001 | G-14 (improves) | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-003` | API platform: client, `ApiError`, problem catalogue, idempotency intent | 002 | — | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-004` | Session platform: carrier port, standing, step-up, expiry, cross-tab | 003 | G-04, G-08 (consumes later) | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-005` | Design-system core: theme, value, state and workflow components | 001 | — | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-006` | Shell, routing, guards, error boundaries, i18n, telemetry skeleton | 004, 005 | — | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-007` | Component catalogue with axe and the production CSP | 005, 006 | — | DOD-CUST | Built (pre-phase, D-A); visual baselines carried to Stage 2 |
| `P18-TSK-008` | Lint as control, with guard tests | 001 | — | DOD-CUST | Built (pre-phase, D-A) |
| `P18-TSK-009` | Packaging (headers config, nginx, image) and CI | 007, 008 | G-15 (prepares) | DOD-CUST | Built (pre-phase, D-A) |

## Stage 2 — Identity and onboarding

| Task | Title | Depends on | Gaps | DoD | Status |
|---|---|---|---|---|---|
| `P18-TSK-010` | Sign-in, sign-out, sessions list and revoke | Stage 1, 101, 102 | G-04, G-15 | DOD-CUST | Built (D-I), in-memory carrier until 101 |
| `P18-TSK-011` | Registration (person) and first sign-in | 010 | G-07, G-03 (verification) | DOD-CUST | Built (D-I); contact verification not built (G-03) |
| `P18-TSK-012` | MFA enrolment and step-up | 010 | — | DOD-CUST | Built (D-I); enrolment state unreadable (G-17); no QR (D-J) |
| `P18-TSK-013` | Consents: current text and version, grant, withdraw, history | 010 | — | DOD-CUST | Built (D-I) |
| `P18-TSK-014` | KYC: case, documents, customer-shaped status | 010, 013 | — | DOD-CUST | Built (D-I); cases cannot progress (G-16) |
| `P18-TSK-015` | Organisation registration and KYB ownership declaration | 014 | G-09 (limits) | DOD-CUST | Built (D-I); owners named by party id (G-09) |
| `P18-TSK-016` | Onboarding checklist and standing-based routing; password recovery when G-03 lands | 011–015 | G-08, G-03 | DOD-CUST | Built (D-I) as the checklist; recovery not built (G-03) |
| `P18-TSK-101` *(backend)* | Cookie session carrier and CSRF defence (ADR-F02) | — | G-04 | finapp `DOD-SEC`, `DOD-API` | |
| `P18-TSK-102` *(backend)* | Public-edge SPA route, headers, deployable, NetworkPolicy, admission, Argo app; `no-store` on customer API | 009 | G-15 | finapp `DOD-SEC`, ops | |
| `P18-TSK-103` *(backend)* | Notification delivery for verification and recovery tokens | — | G-03 | finapp `DOD-SEC` | |
| `P18-TSK-104` *(backend)* | Customer standing on `GET /v1/me` | — | G-08 | finapp `DOD-API` | |
| `P18-TSK-105` *(backend)* | Personal data capture | — | G-07 | finapp `DOD-API`, `DOD-SEC` | |
| `P18-TSK-113` *(backend)* | Run KYC checks in production | — | G-16 | finapp `DOD-API`, `DOD-SEC` | |
| `P18-TSK-114` *(backend)* | A read of the customer's own second factor | — | G-17 | finapp `DOD-API` | |

## Stage 3 — Core banking

| Task | Title | Depends on | Gaps | DoD | Status |
|---|---|---|---|---|---|
| `P18-TSK-017` | Dashboard | Stage 2 | G-02 | DOD-CUST | Built (D-K) on Home: available balance per account and currency; no activity feed (G-02) |
| `P18-TSK-018` | Wallets: open, add currency, close; balances | Stage 2 | G-06 (optional) | DOD-CUST | Built (D-K): one live wallet; open, add currency, close |
| `P18-TSK-019` | Statements | 018 | G-05 (optional) | DOD-CUST | Built (D-K): whole period, no paging; no PDF (G-05) |
| `P18-TSK-020` | Transfer and payment history | 018 | G-01, G-02 | DOD-CUST | Built (D-K): transfers sent and top-ups as finapp lists them (G-01, G-02) |
| `P18-TSK-106` *(backend)* | Cursor pagination and missing customer lists | — | G-01 | finapp `DOD-API` | |
| `P18-TSK-107` *(backend)* | Customer activity read | — | G-02 | finapp `DOD-API`, `DOD-FIN` | |
| `P18-TSK-108` *(backend)* | Contract quality: `securitySchemes`, enums, per-operation problem codes | — | G-14 | finapp `DOD-API` | |
| `P18-TSK-115` *(backend)* | A read of the currencies finapp holds | — | G-18 | finapp `DOD-API` | |

## Stage 4 — Money movement

| Task | Title | Depends on | Gaps | DoD | Status |
|---|---|---|---|---|---|
| `P18-TSK-021` | Beneficiaries | Stage 3 | G-12 | DOD-CUST | Built (D-L): add by account reference, remove; no idempotency on add (G-12) |
| `P18-TSK-022` | Internal transfers | 021 | — | DOD-CUST | Built (D-L): synchronous result, step-up then same key; risk refusals generic |
| `P18-TSK-023` | Payment methods and top-up | Stage 3 | G-10 (card) | DOD-CUST | Built (D-L): list and remove methods, top-up with saved method; adding a method not possible (G-10, G-19) |
| `P18-TSK-024` | Withdrawals | 023 | G-01 | DOD-CUST | Built (D-L): bank accounts only; status page; held reads as processing |
| `P18-TSK-025` | FX conversion | Stage 3 | G-01 | DOD-CUST | Built (D-L): quote, countdown, margin disclosed, convert once |
| `P18-TSK-026` | Cross-border payments | 021 | G-01 | DOD-CUST | Built (D-L): corridors, recipients, quote with fee and total, payment status, cancellation; adding a recipient not possible (G-19) |
| `P18-TSK-027` | Receipts and outcome pages | 022–026 | — | DOD-CUST | Built (D-L) as each journey's result and status pages |
| `P18-TSK-109` *(backend)* | Browser card tokenisation for the simulated PSP | — | G-10 | finapp `DOD-SEC`, ADR | |
| `P18-TSK-110` *(backend)* | Idempotency on `POST /v1/beneficiaries` | — | G-12 | finapp `DOD-API` | |
| `P18-TSK-116` *(backend)* | A browser path to the providers' linking grants (bank accounts, overseas recipients) | — | G-19 | finapp `DOD-SEC`, ADR | |

## Stage 5 — Credit

| Task | Title | Depends on | Gaps | DoD |
|---|---|---|---|---|
| `P18-TSK-028` | Credit profile and decisions | Stage 4 | — | DOD-CUST |
| `P18-TSK-029` | Instalment and revolving loans: apply, accept (terms hash), draw, repay, payoff | 028 | — | DOD-CUST |
| `P18-TSK-030` | BNPL servicing | 028 | G-13 (dispute read) | DOD-CUST |
| `P18-TSK-031` | Checkout confirmation (merchant redirect) | 030 | redirect contract | DOD-CUST |

## Stage 6 — Self-service

| Task | Title | Depends on | Gaps | DoD |
|---|---|---|---|---|
| `P18-TSK-032` | Security centre: sessions, devices, sign out everywhere | Stage 2 | — | DOD-CUST |
| `P18-TSK-033` | Password change; MFA management | 032 | G-11 | DOD-CUST |
| `P18-TSK-034` | Consents centre and profile | Stage 2 | G-07 | DOD-CUST |
| `P18-TSK-035` | Notifications and support — **only if** `finapp` provides them | — | G-03, G-13 | DOD-CUST |
| `P18-TSK-111` *(backend)* | MFA factor removal and recovery codes | — | G-11 | finapp `DOD-SEC` |
| `P18-TSK-112` *(backend)* | Support and complaints; BNPL dispute read | — | G-13 | finapp `DOD-API` |

## Stage 7 — Production readiness

| Task | Title | Depends on | DoD |
|---|---|---|---|
| `P18-TSK-036` | Threat-model update: customer-web boundary in `finapp`'s `THREAT_MODEL.md` | Stage 6 | 1.8 |
| `P18-TSK-037` | Penetration test and ZAP baseline against staging | 102 | 1.8 |
| `P18-TSK-038` | Accessibility audit (WCAG 2.2 AA), manual screen-reader passes | Stage 6 | DOD-CUST |
| `P18-TSK-039` | Performance budgets (Lighthouse CI), runbook, DR behaviour | Stage 6 | 1.11 |
| `P18-TSK-040` | Release checklist and exit review | 036–039 | all |

## Epics outside Phase 18

| Epic | Gap | Note |
|---|---|---|
| Organisation members, mandates, "act as organisation" | G-09 | A new `authorization` module per ADR-0031's split trigger; business banking waits on it |
| Downloadable statements and receiving identifiers | G-05, G-06 | P3; Stage 3 degrades without them |
