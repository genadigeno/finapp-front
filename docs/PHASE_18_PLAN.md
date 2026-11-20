# Phase 18 Plan — Customer Application

**Status: DRAFT — Phase 18 is `PLANNED`; its entry gate has not been run.** Written by `P18-DOC-001` (2026-11-19) after the
owner approved the blueprint's decisions D-A…D-H ("Approve all"). Nothing here changes `finapp`'s phases, tasks, waves or
milestones: Phase 16 is `IN_REVIEW` there and Phase 17 (the Operator Console) is `PLANNED` with its foundation built ahead of
it. The entry gate (`P18-INIT`) reviews this plan against the code as it then stands, corrects it, accepts ADR-F01…F08,
registers the threats of §6, and marks the first Stage 2 task `READY`. Until then every task is `PLANNED`, except the Stage 1
tasks D-A allows in this repository (§2).

Source: the owner's brief of 2026-11-19 and the blueprint written in answer to it
([`CUSTOMER_APP_BLUEPRINT.md`](CUSTOMER_APP_BLUEPRINT.md)). This plan carries the blueprint into the phase's record; **where
the two differ, this plan is right.** The blueprint keeps the analysis (personas, journeys, screen inventory, capability matrix,
diagrams); this plan keeps scope, stages, tasks, gates and decisions.

Inspected: `finapp` master `5227f57e2` (2026-11-17); `finapp-admin-panel` master `5cd1d5b`. File references are relative to
the `finapp` repository's root unless they name this one.

---

## 1. Objective and scope

Give individuals and business registrants a consumer-grade web application to register, verify, hold multi-currency money,
see it, move it, borrow, and manage their security and consents — **on the customer surface `finapp` already serves**, with
every missing capability closed in its owning module, never simulated.

**In scope** (blueprint §5, §14): sign-in, registration, MFA enrolment and step-up, sessions, consents, KYC; organisation
registration and KYB ownership declaration; wallets, balances, statements, history; beneficiaries, internal transfers, top-up,
payment methods, withdrawals, FX conversion, cross-border payments, receipts; credit profile and decisions, loans (instalment,
revolving), BNPL servicing, checkout confirmation; security centre, password, profile.

**Excluded (D-H)** until backend capabilities exist: card issuing (external, ADR-0059 §5), investments (no capability),
scheduled payments, notifications, support and complaints. Credit, lending and BNPL are built but answer `ProductNotOffered` in
production; offering them is a business decision, not this phase's.

**Not in this phase:** organisation members, mandates and "act as organisation" (G-09, an epic of its own); native mobile
applications; a PWA or service worker; marketing pages.

## 2. Governance (D-A)

- Phase 18 of the `finapp` programme, governed **here**: this plan, [`BACKLOG.md`](BACKLOG.md),
  [`DECISIONS.md`](DECISIONS.md), [`adr/`](adr/README.md) (`ADR-F…`), [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md)
  (`DOD-CUST`).
- Frontend tasks are `P18-TSK-0xx`; `finapp` tasks are `P18-TSK-1xx`, written for `finapp`'s team in
  [`FINAPP_BACKEND_WORK.md`](FINAPP_BACKEND_WORK.md). They enter `finapp`'s backlog, under its process, when the owner
  schedules them (D-G).
- **Pre-phase allowance.** `P18-TSK-001`…`-009` (Stage 1) may proceed before the phase opens, in this repository only. They
  change nothing in `finapp` and consume only its published contract. Their completion is recorded at `P18-INIT`. Everything
  that touches `finapp`'s code or `deploy/` waits for the owner to schedule it there.
- `finapp`'s rule of one phase `IN_PROGRESS` is respected: Phase 18 opens only after the owner sequences it behind Phase 16
  and Phase 17.

## 3. Stages

| Stage | Objective | Frontend tasks | Backend dependencies | Exit |
|---|---|---|---|---|
| **0 Discovery** | Approved architecture | `P18-DOC-001` | none | D-A…D-H decided ✅ (2026-11-19); this plan, backlog, ADRs, DoD, backend handoff written ✅ |
| **1 Foundation** | Buildable, gated, empty shell | `P18-TSK-001`…`-009` | **none** (G-14 improves typing, does not block) | §4 |
| **2 Identity & onboarding** | Register, sign in, step up, consent, KYC; KYB for registrants | `-010`…`-016` | **G-04, G-15** (hard); G-03 (recovery and verification screens ship only when it lands); G-08, G-07 | E2E 1–4, 12 against a real `finapp` |
| **3 Core banking** | See my money | `-017`…`-020` | G-01, G-02 (degrade honestly if absent); G-05, G-06 optional | E2E 8, 10 |
| **4 Money movement** | Move money safely | `-021`…`-027` | G-12; G-10 for card top-up; G-01 lists | E2E 5–7, 9, 11 |
| **5 Credit** | Borrow and repay | `-028`…`-031` | product offering (business); G-13 dispute read | offer and terms-hash journeys; MFA paths |
| **6 Self-service** | Manage myself | `-032`…`-035` | G-11; G-03; G-13 | security-centre journeys |
| **7 Production readiness** | Release | `-036`…`-040` | the public-edge route deployed to staging (G-15) | exit review |

Stage details, screens and journeys: blueprint §4, §6, §14, §18.

## 4. Stage 1 — Foundation (full fields)

Every Stage 1 task: DoD `DOD-CUST`; this repository only; no backend change; no application screen beyond the shell and the
catalogue.

| Task | Delivers | Acceptance (blueprint §22 item) |
|---|---|---|
| `P18-TSK-001` Repository, toolchain and supply-chain gates | `package.json` with exact pins and committed lock file; Node engine pin; TypeScript strict; Prettier; licence allow-list check; `npm audit` policy; gitleaks; SBOM; `npm run verify` composing every gate; reproducible build check | 1 |
| `P18-TSK-002` Contract pin and generated types | `contract/openapi.json` pinned by `finapp` commit + sha256 (`contract/SOURCE.json`); `contract:pull`, `contract:generate`, `contract:check`; `src/generated/finapp-api.ts` committed; drift fails CI | 2 |
| `P18-TSK-003` API platform | openapi-fetch client (same-origin `/v1`, `X-Finapp-Request` header, client correlation id); `ApiError` with a kind per §11.1 class (validation, unauthenticated, assurance, forbidden, not-found, conflict, in-progress, rate-limited, unavailable, stale, unknown-outcome, defect); problem-code catalogue; `IdempotencyIntent`; read retry with backoff; command timeout → unknown outcome | 3, 4 |
| `P18-TSK-004` Session platform | carrier-agnostic session port: cookie carrier (ADR-F02) and in-memory fallback (ADR-C131) behind one interface; standing store fed by `GET /v1/me`; step-up flow (`AssuranceRequired` → dialog → rotate → replay once); idle-expiry warning; cross-tab sign-out by `BroadcastChannel` | 3, 6 |
| `P18-TSK-005` Design-system core | customer theme and tokens (generated stylesheet, no runtime style injection); `Money`, `MoneyInput`, `Rate`, `BalanceTriplet`, `StatusChip` (exhaustive maps, unknown → "in progress"), `Countdown`, `CorrelationReference`; states `Loading`, `Empty`, `ErrorExplained`, `FeatureUnavailable`, `UnknownOutcome`, `StepUpDialog`, `SessionExpiring`; `Wizard`, `ReviewPanel`, `ResultPanel`, `ConfirmDangerous`; scale tests 0/2/3 | 5, 6 |
| `P18-TSK-006` Shell and routing | TanStack Router with typed routes and module code-splitting; route guards (session, standing, feature availability); route-level error boundaries; `returnTo` allow-list; FormatJS with an English catalogue; telemetry skeleton with an allow-list schema and spy transport | 6, 8 |
| `P18-TSK-007` Component catalogue and CSP proof | catalogue of every design-system component in light and dark; Playwright run with axe and the production CSP + Trusted Types; zero violations required; visual baselines | 7 |
| `P18-TSK-008` Lint as control | ESLint rules: money-as-number, injection sinks, storage of query data, `localStorage` beyond the allow-listed key, cross-module imports, runtime-style Mantine components; `tests/eslint-guards` proving each rule fails on a planted violation; storage test | 5, 9 |
| `P18-TSK-009` Packaging and CI | `config/customer-web-headers.mjs` (the CSP of ADR-F07 as data, for `finapp`'s edge), `config/nginx.conf`, Dockerfile (nginx-unprivileged, read-only root), bundle scan (no source maps, no MSW in `dist/`), CI workflow running `verify`, catalogue and image build; README with commands | 1, 10, 11 |

Item 10 of §22 (the documents) is delivered by `P18-DOC-001`. Item 11 (no mock data outside tests; no screen claiming a missing
capability) is checked across every task.

**Sequence:** `001` → `002` → (`003`, `005`, `008` in parallel) → `004` → `006` → `007` → `009`.

### 4.1 Stage 1 record (2026-11-19, the owner's "Start Stage 1")

Built in this repository under D-A's pre-phase allowance; `finapp` unchanged. Completion is recorded at `P18-INIT`.

| §22 item | Evidence |
|---|---|
| 1 `npm run verify` green, reproducible | `verify` passes: pins, licences (47 shipped / 254 tooling packages), contract, typecheck, lint, format, 186 tests, build, bundle scan. `check:reproducible`: two builds byte-identical. `npm audit --omit=dev`: 0 vulnerabilities |
| 2 Contract pinned, drift fails | `contract/SOURCE.json` pins finapp `5227f57e2627eb040f694487b31cea83709ef831` by sha256; `tests/contract-pin.test.ts` proves removing `ProfileResponse.kind` breaks the build |
| 3 `ApiError` classes; no auto-retry; unknown outcome distinct | `src/platform/api/api-error.ts` (`category`, `commandOutcome`), `command.ts`; `api-error.test.ts`, `command.test.ts` |
| 4 `IdempotencyIntent` once per review, reused | `idempotency.ts` freezes the reviewed body; `command.test.ts` asserts one key and one body across step-up and in-progress re-sends |
| 5 Money string-only, scales 0/2/3, lint proven | `design-system/money.ts` (Intl on the string, digit-for-digit check, fallback); `money.test.ts`; `tests/eslint-guards.test.ts` |
| 6 Shell, router, boundaries, `FeatureUnavailable`, `UnknownOutcome`, `StepUpDialog` in the catalogue | `src/app/`, `catalogue/Catalogue.tsx`; `app.test.tsx` |
| 7 Catalogue axe + zero CSP violations, both themes | `npm run test:catalogue`: 22 checks pass on a desktop and a phone viewport (axe WCAG 2.2 AA, CSP with Trusted Types, 44 px targets, the application's own start page and redirect) |
| 8 Nothing sensitive reaches telemetry | `telemetry.test.ts` with a spy transport |
| 9 Only the preferences key in storage | lint rules + `platform.test.ts` + the browser check of the built application |
| 10 Documents | `P18-DOC-001`; this record; README with commands |
| 11 No mock data outside tests; no claimed capability | MSW not installed; bundle scan; the start page says sign-in is not available yet; the shell shows only pages that exist |

**Deviations and corrections** (where this plan and the blueprint differ, this plan is right):
1. **Blueprint §11.1 corrected.** It listed `*.ProviderUnavailable` with the 503s after which "nothing was done". finapp's
   `ERROR_CONTRACT.md` declares that only for `api.Overloaded` and `api.TemporarilyUnavailable`; a provider 503 on a
   command is therefore an **unknown outcome** here, and is never re-sent automatically.
2. **The session carrier defaults to `memory`** (`VITE_SESSION_CARRIER`) until finapp ships G-04; the cookie carrier is
   built and tested, and switching is configuration.
3. **Feature availability** is enforced by the route error boundary: a 503 that finapp declares not served renders
   `FeatureUnavailable` for that page while the rest works. A per-module availability store waits for the first module.
4. **Route-level code splitting** is configured (vendor chunks; modules load on first visit) but has no module to split
   until Stage 2.
5. **Not delivered: visual-regression baselines** (`P18-TSK-007`). Screenshots differ by machine and font stack; they are
   recorded on the CI runner once CI exists for this repository. Carried to Stage 2.
6. **React Hook Form and Zod are not installed yet**: no form exists in Stage 1. They join with the first form
   (`P18-TSK-010`), pinned as ADR-F03 says.
7. **Money formatting** uses the locale's currency symbol, which `Intl` disambiguates by locale (`JP¥` in `en-GB`).
8. **Dialogs are judged by axe once settled** (reduced motion): during the fade-in their text is translucent.
9. **Local browser runs** use an installed browser (`PW_CHANNEL=msedge`): the Chromium build Playwright 1.65.0 pins is not
   on this machine and was not downloaded. CI installs the pinned one.
10. **Tooling audit**: 9 moderate advisories (minimatch, through eslint and typescript-eslint), none in what ships; CI's
    tooling gate is `high`. The console carries the same; both clear when eslint and typescript-eslint are bumped.

### 4.2 Stage 2 record (2026-11-19, D-I: the owner's "Start Stage 2")

Built in this repository ahead of the entry gate; `finapp` unchanged. Every screen is over a door finapp serves today,
read against `5227f57e2` controller by controller (sign-in, registration, MFA, sessions, consents, KYC, organisations,
KYB, channels), with the in-memory session carrier (`VITE_SESSION_CARRIER=memory`) until G-04.

| Task | Built | Evidence |
|---|---|---|
| `P18-TSK-010` | Sign-in (uniform refusal; password never kept), sign-out, signed-in devices with confirmed sign-out of another; signed-out visitors go to sign-in with a validated `returnTo`, signed-in customers skip it | `security.test.tsx`; browser check of `/sign-in` |
| `P18-TSK-011` | Registration under an idempotency key, then sign-in with the same credentials (finapp does not sign in on registration); uniform `party.RegistrationRefused`; unknown outcome re-sent with the same key | `onboarding.test.tsx`; browser check of `/register` |
| `P18-TSK-012` | Authenticator enrolment: setup key shown once, grouped, held in memory only, forgotten on confirmation; replacing a factor steps up first and re-sends on the rotated token | `security.test.tsx` |
| `P18-TSK-013` | Consents with finapp's own text and version; grant names the version read; withdrawal confirmed | `onboarding.test.tsx` |
| `P18-TSK-014` | Identity verification: consent gate, start, document upload (base64, finapp's type names, 512 KB and type checked before sending) | `onboarding.test.tsx` |
| `P18-TSK-015` | Business registration; KYB status and owners; declaring an owner by customer reference, share by string arithmetic to basis points | `onboarding.test.tsx` |
| `P18-TSK-016` | The onboarding checklist on Home, every step from finapp's reads | `onboarding.test.tsx` |

Gates: `npm run verify` green (213 tests); `test:catalogue` 28 browser checks green (axe and zero CSP violations on the
real `/sign-in` and `/register`, the onboarding controls, both themes, desktop and phone); builds byte-identical; first
load 195 kB gzipped.

**Found, fixed, recorded:**
1. **Zod 4 probes `new Function`** on first parse; the CSP refuses it and the browser reports a Trusted Types violation.
   Zod runs `jitless` (`src/platform/forms/zod-resolver.ts`). `@hookform/resolvers` was not taken (days-old major, dozens
   of peers): a 15-line resolver does the job.
2. **One Mantine vendor chunk** put every component any page uses into the first load (206 kB gzipped, over budget). It is
   no longer grouped; the entry cap rises from 64 to 96 KiB with the reason recorded in `scripts/lib/bundle-scan.mjs`.
3. **Mantine's placeholder colour** fails 4.5:1; overridden in the generated theme.
4. **`useCommand` would have reused one request's idempotency key for another** (`submit` after a definite outcome). An
   intent now outlives its send only while its outcome is unknown, and only for the identical request.

**New gaps** (handed to finapp in `FINAPP_BACKEND_WORK.md`):
- **G-16 (P0): KYC checks are never run in production.** A case stays `OPEN`; no customer can reach `APPROVED`. The
  application shows the status finapp reports and promises nothing more.
- **G-17: no read of the customer's own second factor.** Two-step verification is offered, never shown as on.
- **G-09 (detail):** an owner can be named only by party id, which nothing lets a registrant look up; every customer's
  Home shows their own reference to share.

**Not built:** password recovery and contact verification (G-03 - nothing delivers the token); profile edit (Stage 6).
**Not yet run:** the E2E scenarios 1–4 and 12 against a real finapp (acceptance of this stage) - the local finapp stack
needs container images this machine does not have; pulling them is the owner's call.

**Open decision D-J (owner):** a QR code for authenticator setup needs a QR library (MIT options exist) - a new shipped
dependency. Until decided, the setup key is typed or opened by link.

### 4.3 Stage 3 record (2026-11-19, D-K: the owner's "Start Stage 3")

Built in this repository ahead of the entry gate; `finapp` unchanged. Read against `5227f57e2` controller by controller
(accounts, balances, statement, transfers, payments).

| Task | Built | Evidence |
|---|---|---|
| `P18-TSK-017` | Home shows each live account's available balance per currency, with when it was read, once the customer holds an account; onboarding stays first otherwise | `accounts.test.tsx` |
| `P18-TSK-018` | Accounts list; opening a wallet under an idempotency key, offered only when no wallet is live (finapp allows one, and a second "open" returns the first unchanged); a wallet's balances per currency (available, settled, on hold - never summed); adding a currency (only finapp's five, minus those held); closing after confirmation | `accounts.test.tsx` |
| `P18-TSK-019` | Statement for a chosen period (business dates, checked for order and the future before asking): per currency, finapp's opening, every line in finapp's order with its direction in words and sign, reversals as their own lines, finapp's closing | `accounts.test.tsx`, `period.test.ts` |
| `P18-TSK-020` | Activity: transfers sent and top-ups/purchases, each list whole and in finapp's order, saying that received money is on the statement; no refusal reason shown | `accounts.test.tsx` |

Gates: `npm run verify` green (235 tests); `test:catalogue` 30 browser checks green; builds byte-identical; first load
187 kB gzipped.

**Found, fixed, recorded:**
1. **The theme toggle's Tooltip** put its positioning library into every page's first load; a native `title` replaces
   it (first load 196 -> 187 kB gzipped).
2. **The entry cap** (`scripts/lib/bundle-scan.mjs`) rises 96 -> 128 KiB: the step-up dialog's positioning and scroll
   code, now also used by the pages' selects, moved from a separate first-load chunk into the entry - the same bytes,
   one file fewer. The gzip first-load budget stays binding.
3. **Mantine's tabs are 37 px tall**; raised to the 44 px target with the other controls.

**What the customer cannot see yet** (handed to finapp): one feed of everything that moved (G-02 - transfers received
appear only on the statement); paged lists (G-01); withdrawal, FX and cross-border lists; a read of the currencies
finapp holds (new **G-18**, P3 - the application keeps a copy of finapp's five); PDF statements (G-05).

**Still true:** no customer can open a wallet through the application until finapp runs its KYC checks (G-16): opening
needs an approved identity, and finapp answers `accounts.AccountOpeningRefused` until then, which the page explains.

### 4.4 Stage 4 record (2026-11-19, D-L: the owner's "Start Stage 4, always commit changes")

Built in this repository ahead of the entry gate; `finapp` unchanged. Read against `5227f57e2` controller by controller
(beneficiaries, transfers, payment methods, payments, withdrawals, FX, cross-border).

| Task | Built | Evidence |
|---|---|---|
| `P18-TSK-021` | Recipients: add by account reference (finapp has no search for another customer), remove after confirmation | `move-money.test.tsx` |
| `P18-TSK-022` | Send to someone at FinApp: details -> review (one intent) -> result; finapp answers COMPLETED or FAILED at once; a risk check steps up, then the same request goes again under the same key; failures the customer can act on are explained, risk and limit refusals are generic | `move-money.test.tsx` |
| `P18-TSK-023` | Cards and bank accounts (list, remove); add money with a saved method: open under a key and confirm; a card answers at once, a bank sends the customer to approve (https links only) and the status page follows the payment | `move-money.test.tsx` |
| `P18-TSK-024` | Withdraw to a linked bank account (bank accounts only); the status page follows it; a hold reads as processing | `move-money.test.tsx` |
| `P18-TSK-025` | Exchange: available pairs only, quote under a key, rate and margin (string arithmetic) shown, countdown on finapp's clock disables confirm at expiry, convert once; leaving a quote cancels it | `fx-crossborder.test.tsx` |
| `P18-TSK-026` | Send abroad: corridors with fee and delivery estimate, overseas recipients with their state (never why), quote with fee and total debit first, payment under a key, status page with cancellation while it can be recalled | `fx-crossborder.test.tsx` |
| `P18-TSK-027` | Each journey's result panel and the status pages of what is still in progress (bounded polling) | as above |

Gates: `npm run verify` green (259 tests); `test:catalogue` 32 browser checks green; builds byte-identical; first load
192 kB gzipped.

**Shared pieces added:** wallet reads moved to `src/platform/customer/wallets.ts` (modules may not import each other);
`PocketSelect`, `CommandOutcome`, `useReviewFlow`, bounded polling (`src/platform/query/polling.ts`); `useOnline` moved to
the platform.

**Found, fixed, recorded:**
1. **Radios are 20 px**; each radio row (control and label, one target) is now at least 44 px.
2. **The test transport shared `Response` objects across requests**; a cancelled request tore one down and later tests
   read a network failure. Each scripted answer is now a factory (`src/testing/scripted-finapp.tsx`).
3. **Two browsers running full-page axe side by side stalled** on this machine; the catalogue run uses one worker.
4. **A held withdrawal now reads "Processing"** (it read "On hold"): no hint of review (INV-RSK-08).

**What the customer cannot do yet** (handed to finapp): add a card (G-10 - no tokenisation path, and the tokenisation
service is unset everywhere); link a bank account or add an overseas recipient (new **G-19** - no browser path to the
providers' grants). Top-up confirmation and withdrawals answer `payments.ProviderUnavailable` wherever finapp's provider
URLs are unset (every environment but the test overlay); the pages explain it. A recipient at FinApp is named only by
account reference (G-09 territory).

### 4.5 Stage 5 record (2026-11-19, D-M: the owner's "Start Stage 5")

Built in this repository ahead of the entry gate; `finapp` unchanged. Read against `5227f57e2` controller by controller
(credit decision requests and profile, loan applications, offers and loans, BNPL applications, offers, agreements and
disputes, checkout confirmation and BNPL options) and against `ERROR_CONTRACT.md`.

| Task | Built | Evidence |
|---|---|---|
| `P18-TSK-028` | Credit home: loans and credit lines, pay-later plans, current answers and when finapp last looked at the credit history; check what you could borrow (loan or line, optional declared income and outgoings) under a key, answered later (202) on its own page with bounded polling; an approval shows what finapp approved, a decline only finapp's customer reasons; cancellation while finapp is still gathering; missing consent leads to the consents page | `credit.test.tsx` |
| `P18-TSK-029` | Apply (payout and repayment through the wallet, repayment day); the application page follows it to an offer and allows withdrawal; the offer shows every figure finapp computed (rate as a percentage by string arithmetic, illustrated schedule, total interest, total to repay, minimum payment for a line) and the agreement text in a keyboard-scrollable region, and is accepted only after "I have read" with the terms hash echoed; `TermsChanged` re-reads the offer, clears the tick and needs a new acceptance under a new key; decline after confirmation. The loan page: what is owed by component, overdue days (never a bucket), schedule, repayments, statements for a line; repay or pay extra (prepayment) from the wallet; pay off from a quote (a stale quote is asked for again, never paid); draw from a line up to its available limit (no draw while suspended, no reason); close a line | `credit.test.tsx` |
| `P18-TSK-030` | The pay-later plan: purchase, owed, instalments with paid and still due, repayments; repay; pay off from a quote; report a problem with the purchase (category, amount, reason up to 1,000 characters), shown with its reference, paused payments and the shop's deadline, and withdrawable from the same page | `credit.test.tsx` |
| `P18-TSK-031` | Pay a shop: the checkout code typed in and held in memory only (never a URL, storage or telemetry); pay from the wallet or a saved card or bank account with no idempotency key (finapp continues the same payment), the amount shown from finapp's answer; a bank payment offers its https approval link; "check again" re-confirms; pay later lists the shop's plans with their illustration and applies under a key, then follows the application to its offer | `credit.test.tsx` |

Gates: `npm run verify` green (280 tests); `test:catalogue` 36 browser checks green; builds byte-identical; first load
196 kB gzipped (entry 117 KiB).

**Shared pieces added:** the payment-methods read moved to `src/platform/customer/payment-methods.ts` and
`fractionToPercent` to `src/design-system/money.ts` (modules may not import each other); status maps for credit checks,
their outcome, applications, offers, instalments, pay-later plans, disputes and checkout; wording for 32 credit, pay-later
and checkout codes, each in finapp's `ERROR_CONTRACT.md`.

**Found, fixed, recorded:**
1. **Seven entries overflowed the phone navigation by 59 px** (Pixel 7). Each entry now takes an equal share and a
   two-word label wraps; a new browser check holds the bar to the screen and every entry to 44 px. The catalogue's
   navigation now has the application's seven entries.
2. **A written-off loan read "Closed by us"**, as if settled. It now reads "Written off - still owed" (caution): finapp
   stops collecting but the balance is owed.
3. **Checkboxes are 20 px**; the checkbox row is now a 44 px target, as radios are, and the touch-target check measures it.

**What the customer cannot do yet** (handed to finapp): arrive from a shop without typing the code, or see the amount
before paying (new **G-20**); return to a check or application after leaving its page, or see an amendment offered to
them (new **G-21**; amendments are not built); read a dispute later (G-13, confirmed). In production every application
answers `ProductNotOffered` (no active lending or BNPL terms; terms are activated as data under four eyes), which the
pages explain.

**For legal and compliance review** (not asserted by the repository): finapp sends no APR (its decision L8), so none is
shown; consumer-credit pre-contractual disclosure rules may require one. The offer shows the fixed borrowing rate, the
illustrated schedule, total interest and total to repay.

### 4.6 Stage 6 record (2026-11-19, D-N: the owner's "Start Stage 6")

Built in this repository ahead of the entry gate; `finapp` unchanged. Read against `5227f57e2`: the credential,
profile, contact-channel, recovery, session and MFA controllers and their identity services.

| Task | Built | Evidence |
|---|---|---|
| `P18-TSK-032` | The security centre links two-step verification, signed-in devices, password, your details and your consents. Devices: "sign out all other devices" after confirmation ends each other session in turn (finapp has no bulk door, G-22; one already gone, 404, is not an error); this device stays signed in | `self-service.test.tsx` |
| `P18-TSK-033` | Change your password: current password as proof, step-up first when the customer has a second factor (the same request is then sent again), length 8-256 checked before sending (finapp's only rule), passwords cleared from the page once sent, no idempotency key (the contract has none); finapp rotates the session - the new token is taken up before anything else is sent and never reaches page state - and signs out every other device. A wrong current password or a lockout gets one plain answer and does not sign the customer out. Removing a factor and recovery codes: no door (G-11) | `self-service.test.tsx` |
| `P18-TSK-034` | Your details: name (or business name), sign-in name, customer type, customer since, customer reference; the name changed in place (1-200 characters, control and invisible characters refused as finapp refuses them); consents reached from the centre and the details page | `self-service.test.tsx` |
| `P18-TSK-035` | Not built: finapp has no notification or support door for customers (G-03, G-13, confirmed) | — |

Gates: `npm run verify` green (288 tests); `test:catalogue` 36 browser checks green; builds byte-identical; first load
196 kB gzipped.

**Found, recorded:**
1. **finapp answers a wrong current password with `401 identity.AuthenticationFailed`.** The client counts every 401 as
   unauthenticated; commands do not end the session on it (only reads do, through the query cache), and the password
   page words this code itself, so a mistyped password never reads as "you have been signed out". A test holds it.
2. **Password recovery cannot be offered**: neither the token nor the recovery request identifier reaches the customer
   (G-03, extended). Contact addresses (e-mail only) cannot be verified for the same reason and are not offered.
3. **Organisations hold no sign-in in finapp**: every signed-in customer is a person, so the business-name label on
   the details page is defensive only.

### 4.7 Stage 7 record (2026-11-19, D-O: the owner's "Start Stage 7")

Production readiness, as far as this repository can take it; `finapp` unchanged.

| Task | Done | Evidence |
|---|---|---|
| `P18-TSK-036` | The customer-web boundary drafted for `finapp`'s threat model: assets, trust, twelve threats (STRIDE) each with its control, its evidence in this repository and its residual risk, and what only `finapp` can close | `THREAT_MODEL_CUSTOMER_WEB.md` |
| `P18-TSK-037` | **Blocked** - no staging deployment of the edge route (G-15). The ZAP baseline command and its expected result are written down for when staging exists | `RELEASE_CHECKLIST.md` §3 |
| `P18-TSK-038` | A browser sweep of every page of the production build under the real headers: the start, sign-in and registration pages and all 44 signed-in pages, signed in through the real sign-in page against a scripted finapp - axe WCAG 2.2 AA, CSP and Trusted Types, no sideways scrolling on a phone; light theme on desktop, dark on a phone. The audit lists what that proves and the manual passes still to do | `e2e/catalogue/app-sweep.spec.ts`, `fake-finapp.ts`; `ACCESSIBILITY_AUDIT.md` |
| `P18-TSK-039` | Budgets measured on Lighthouse's mobile profile (CPU 4x slower, 150 ms, 1.6 Mbit/s): start page LCP 2,192 ms (budget 2,500), CLS 0; 18 interactions while signing in and moving between pages, slowest 120 ms (budget 200). Runbook: what runs, configuration, release and rollback, health, failure behaviour with evidence, incidents | `e2e/catalogue/performance.spec.ts`; `RUNBOOK.md` |
| `P18-TSK-040` | Release checklist and exit review: **not ready for customers** - four `finapp` P0 gaps, no staging, no manual accessibility pass, no end-to-end run against a real `finapp` | `RELEASE_CHECKLIST.md` |

Gates: `npm run verify` green (292 tests); `test:catalogue` 48 browser checks green (catalogue, application sweep,
performance budgets; two performance checks run on the phone profile only); builds byte-identical; first load 196 kB
gzipped.

**Found, fixed, recorded:**
1. **A credit line's page asked finapp for an instalment schedule** before it knew the product (the first tab defaulted
   to the schedule while the loan was loading): finapp would answer 404 and the page showed "We could not find that".
   The tabs now read nothing until the loan is known; a unit test holds it (it fails without the fix).
2. **Wide tables scrolled inside regions a keyboard could not reach** (axe `scrollable-region-focusable`, on a phone):
   the credit schedules and statements, the account statement and the business owners. A labelled, focusable
   `ScrollableTable` replaces them.
3. **nginx served everything uncompressed.** The first load is about 620 KiB raw - some 3 s of transfer alone on a
   mid-range phone, over the 2.5 s LCP budget. gzip is on in `config/nginx.conf`; measured compressed, 237 KiB.
4. **Offline behaviour and the read retry policy had no test**; both now do (`resilience.test.tsx`,
   `retry-policy.test.ts`).
5. **LCP had about 3% headroom and missed the budget once (2,768 ms) when the whole browser suite ran on this
   machine.** The start page was a lazy chunk fetched only after the entry had run - a round trip in front of the first
   paint. It now travels with the entry (1 KB): LCP 2,424 -> 2,192 ms. The 42 KB (gzip) Mantine stylesheet is the next
   lever - per-component CSS - not done.
6. **A git worktree of another session appeared under `.claude/worktrees/`** while the gates ran; the format check
   failed on its files and the machine was starved (a guard test timed out at 188 s). `.claude/` is now ignored by
   Prettier and ESLint; git already ignored it. The worktree was left untouched.

**Deviation:** the blueprint names Lighthouse CI for the budgets. Adding it is a new dependency with its own browser
download; the same budgets are measured with the Playwright and DevTools-protocol tooling already in use (D-O). LCP
has about 12% headroom; a measurement on a loaded machine varies by a few hundred milliseconds.

### 4.8 Visual refresh record (2026-11-20, D-P: the owner's "make front end app more beautiful ... cover all pages")

One calm look across every page, so the application reads as a finance product; it changes no behaviour, no
message and no request; `finapp` unchanged.

| Area | Done |
|---|---|
| Palette | Mantine's bright blue replaced by a muted navy primary (`theme.ts`) and a slate dark scheme; info tones are navy. Colour still marks status only (green, amber, red, grey), never decoration |
| Surfaces | Pages sit on a soft grey canvas with white cards and a hairline border (dark: slate layers); the balance card is navy with white figures; journeys (wizards) sit in one panel; empty states are dashed |
| Type | Headings in ink, numbers in tabular figures, badges in sentence case, buttons in semibold; the system font stack is kept (no web font to download) |
| Ledger | Tables as a ledger: quiet header, hairline rows, figures right-aligned; review rows on hairlines with the amount in ink |
| Shell | A small logo mark beside the name; navigation entries dimmed with the current one on a navy tint; the phone bar marks the current entry with a top bar |
| Start, sign-in, registration | The start page has a short lead, the two ways in and three feature cards that each describe something the application does today; sign-in and registration sit in one card |
| Links | Every plain link (including router links) looks like Mantine's anchor: navy with a thin offset underline, still underlined (WCAG 1.4.1) |
| Corners (D-Q) | Square everywhere - buttons, inputs, cards, badges, alerts, dialogs, the logo mark and the wizard's step numbers - through a zero radius scale in `theme.ts`; radio buttons stay round |

Reviewed by eye on screenshots of all 44 pages, desktop and phone, light and dark (`e2e/catalogue/screenshots.spec.ts`,
run only when `SHOTS_DIR` names a folder; Edge runs it with `--disable-gpu` because headless screenshots stalled on
this machine).

Gates: `npm run verify` green (292 tests; one lint guard timed out at 60 s while the machine was at 100% CPU and
passed when rerun); first load 196,834 B gzipped (budget 200 kB); builds byte-identical. `test:catalogue`: 47 of 48
green - accessibility in both themes, CSP and Trusted Types, touch targets, navigation fit and the start page's LCP;
the interaction budget on the phone profile measured 296 ms (budget 200) on that loaded machine, where the commit
before the refresh measured 424 ms (finding 5). **To do:** measure the budgets again on an idle machine.

**Found, fixed, recorded:**
1. **The sticky header could cover what the browser scrolls to.** A field taking focus, or a control scrolled into
   view, could stop under the 64 px header (WCAG 2.4.11 asks that focus is not hidden). The page now keeps a
   scroll padding below the header, and above the phone's bottom bar.
2. **The browser checks judged a control by where the last click had scrolled.** The refresh made the component
   catalogue slightly taller, so at the bottom of the page one radio button sat 2 px under the sticky header and axe
   reported it as too small to tap (`target-size`). Accessibility is now judged from the top of the page, where
   nothing is under the header (`e2e/catalogue/checks.ts`).
3. **A full browser run once timed out on nearly every check** (waiting for the sign-in field to become editable):
   the machine was busy; the same checks passed when run again.
4. **A first cut darkened the danger button in the dark scheme below AA.** Setting the primary shade to suit navy
   (8 light, 6 dark) moved every palette's filled colour with it: the red "Close wallet" button fell to about 3.3:1.
   Every palette is back on shade 9; navy alone gets its filled shades in `theme-stylesheet.ts`.
5. **The performance budgets were measured on a machine at 100% CPU** (other programs). Measured back to back on the
   phone profile, the refresh was no slower than the commit before it: LCP 2,552 ms against 3,484 and 3,196 ms;
   slowest interaction 176 ms against 208 and 424 ms. The start page transfers 238 KiB, 3 KiB more than before. On an
   idle machine Stage 7 measured 2,192 ms and 120 ms.

## 5. Owner decisions

| # | Decision | Decided | Record |
|---|---|---|---|
| D-A | Phase 18 governance here; pre-phase allowance for Stage 1 | 2026-11-19, "Approve all" | §2 |
| D-B | This directory is the `finapp-front-end` repository | 2026-11-19 | ADR-F01 |
| D-C | One application for individuals and business registrants | 2026-11-19 | ADR-F01, ADR-F06 |
| D-D | Cookie session carrier in the monolith (option B) | 2026-11-19 | ADR-F02 |
| D-E | No BFF, no gateway | 2026-11-19 | ADR-F01 |
| D-F | Stack per blueprint §8 | 2026-11-19 | ADR-F03 |
| D-G | G-04, G-15, G-03 are P0 for `finapp` | 2026-11-19 | `FINAPP_BACKEND_WORK.md` |
| D-H | Exclusions | 2026-11-19 | §1 |

| D-I | Start Stage 2 ahead of the entry gate, frontend only; finapp work stays handed off | 2026-11-19, "Start Stage 2" | §4.2 |

| D-J | A QR library for authenticator setup | **open** | §4.2 |
| D-K | Start Stage 3 ahead of the entry gate, frontend only | 2026-11-19, "Start Stage 3" | §4.3 |
| D-L | Start Stage 4 ahead of the entry gate, frontend only; commit each stage | 2026-11-19, "Start Stage 4, always commit changes" | §4.4 |
| D-M | Start Stage 5 ahead of the entry gate, frontend only | 2026-11-19, "Start Stage 5" | §4.5 |
| D-N | Start Stage 6 ahead of the entry gate, frontend only | 2026-11-19, "Start Stage 6" | §4.6 |
| D-O | Stage 7 as far as this repository goes; budgets by Playwright, not Lighthouse CI | 2026-11-19, "Start Stage 7" | §4.7 |
| D-P | A visual refresh of every page: navy and slate, cards, ledger tables; no behaviour change | 2026-11-20, "make front end app more beautiful" | §4.8 |
| D-Q | Keep the D-P look; square corners on every box | 2026-11-20, "only sharp corners on buttons and divs" | §4.8 |
| D-R | Map finapp for end users and clients; build what a customer session can use; no merchant portal (G-23) | 2026-11-20, "deep research of back end finapp ... apply them" | §4.9 |

Further decisions are numbered from D-S and recorded in [`DECISIONS.md`](DECISIONS.md).

## 6. Threats to register at `P18-INIT`

To be added to `finapp`'s `THREAT_MODEL.md` as a customer-web boundary (Stage 7 at the latest):
1. Session riding by injected script while the page is open (ADR-F02 residual; ADR-F07 control).
2. CSRF against the cookie carrier (ADR-F02 §4).
3. Duplicate money movement from client retries (ADR-F05).
4. Leakage of personal or financial data through telemetry, storage, URLs or caches (ADR-F07).
5. Open redirect through the post-sign-in return path.
6. Account enumeration through registration and recovery screens (uniform responses; G-03).
7. Supply-chain compromise of a frontend dependency (ADR-F03 gates).
8. Misleading financial display (float conversion, stale balances, local time-zone shifts of business dates) (ADR-F04).

## 7. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| ADR-F02 not adopted or delayed in `finapp` | Stage 2 blocked | Session port supports the in-memory carrier; owner may ship with option A and record the UX cost |
| No notifier (G-03) has an owning phase | No e-mail verification or password recovery | Those two screens ship only when G-03 lands; nothing pretends |
| Contract enums weak (G-14) | Statuses stringly typed | Exhaustive maps with an "unknown" branch; re-pin when G-14 lands |
| Credit and BNPL not offered in production | Stage 5 dark in production | Build and test against non-production; show `ProductNotOffered` honestly |
| Organisation model thin (G-09) | Business banking limited to registration and KYB | Stated in scope; epic for `finapp` |
| Dependency churn (TypeScript 7 vs typescript-eslint) | Toolchain friction | Follow the console's recorded deviation |
| One owner across three repositories | Throughput | Stage 1 needs nothing from `finapp`; backend items are self-contained handoffs |
