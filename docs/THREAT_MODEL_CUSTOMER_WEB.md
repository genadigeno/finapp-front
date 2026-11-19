# Threat model — the customer-web boundary

**Task:** `P18-TSK-036` (DoD 1.8). **Status:** drafted here, 2026-11-19, at Stage 7. It is written for adoption into
`finapp`'s `docs/security/THREAT_MODEL.md` as a new boundary (`PHASE_18_PLAN.md` §6; handoff B0.1): this repository
does not change `finapp`, so the section below is the text to carry over. Read against `finapp` `5227f57e2` and this
repository at the Stage 7 commit.

## Boundary

```
Customer's browser ──TLS──> public edge (Traefik) ──> finapp-customer-web (nginx, static files only)
        │                                       └──> /v1/** allow-list ──> finapp-app (public surface)
        └── the application runs here: React, in memory, under the customer-web CSP
```

**Assets crossing it:** the session token (bearer, in memory - ADR-F02 option A until G-04); passwords at sign-in,
registration and password change; the checkout code a shop gives a shopper (a bearer secret); two-step setup keys;
balances, statements and every figure of a payment, loan or plan; the customer's name, sign-in name and reference.

**Trust:** the browser is the customer's but not trusted to decide anything - every amount, status, eligibility and
outcome is `finapp`'s (ADR-F04, DOD-CUST "no business rule in the client"). The application is trusted only to show
what `finapp` sent, to send exactly what the customer reviewed, and to keep secrets out of places that outlive the page.

## Threats, controls and evidence

| # | Threat (STRIDE) | Control | Evidence | Residual |
|---|---|---|---|---|
| T1 | **Session riding by injected script** while the page is open (E, I) | CSP `script-src 'self'`, no inline script, `require-trusted-types-for 'script'` with `trusted-types 'none'`; lint bans every injection sink; no third-party script; the token is never in storage or a URL | `e2e/catalogue/app-sweep.spec.ts` (zero CSP / Trusted Types violations on every signed-in page, both themes); `tests/eslint-guards.test.ts` "script-injection paths are banned" | With option A the token is readable by script in the page's memory; a script that defeats the CSP could use it until it expires (30 min idle, 12 h absolute). G-04 (HttpOnly cookie, ADR-F02) removes it from script reach |
| T2 | **CSRF** against the cookie carrier (S, T) | Every request sends `X-Finapp-Request: 1` (a header a cross-site form cannot set) and the cookie carrier will be `SameSite=Strict`; `form-action 'self'` | `tests/api-client.test.ts` (cookie carrier opts in, never sends a bearer) | Not live until G-04: today there is no cookie to ride |
| T3 | **Duplicate money movement** from client retries (T) | One idempotency key per reviewed request; the same key only for the same request while the outcome is unknown; never an automatic re-send beyond ADR-F05's cases; the confirm control disables on the first press | `src/platform/api/command.test.ts`; each module's journey tests (same key after step-up, new key after an edit) | Checkout confirmation carries no key (`finapp`'s contract): `finapp` continues the same payment on a repeat, which the page relies on |
| T4 | **Leakage** of personal or financial data through telemetry, storage, URLs or caches (I) | Telemetry by allow-list with pattern-checked fields, a discarding default transport; one `localStorage` key (preferences); query data in memory only; no identifier of the customer in a path; the checkout code typed in, held in memory, never in a URL or query key; `Referrer-Policy: no-referrer`; `Cache-Control: no-store` on the API (G-15) | `src/platform/telemetry/telemetry.test.ts`; `src/platform/platform.test.ts` "browser storage holds one allow-listed key"; app sweep "nothing but the preferences key is stored"; `credit.test.tsx` "the code in the body only - never a URL" | Finapp identifiers of a payment, loan or offer do appear in paths (they name the customer's own record, not the customer); `no-store` on `/v1` waits for G-15 |
| T5 | **Open redirect** through the post-sign-in return path (S) | `returnTo` is checked at the point of use against an allow-list built from the routes marked returnable - static, identifier-free paths | `src/platform/platform.test.ts` "no open redirect after sign-in"; `src/app/app.test.tsx` "a forged returnTo never reaches a page" | — |
| T6 | **Account enumeration** through sign-in, registration and recovery (I) | One uniform answer for every sign-in refusal and every wrong current password; recovery is not offered (G-03) | `security.test.tsx` "says the same thing for every refusal"; `self-service.test.tsx` (wrong password and lockout read alike) | Registration's `party.RegistrationRefused` is `finapp`'s uniform answer; the screen adds nothing |
| T7 | **Supply-chain compromise** of a frontend dependency (T, E) | Exact pins checked against the lockfile; licence policy; contract pinned by commit and hash; `npm audit` in CI; reproducible builds; no source maps, no test doubles in `dist/`; base image by digest | `npm run verify` (pins, licences, contract, bundle scan); `npm run check:reproducible`; `.github/workflows/ci.yml` | A malicious version published under a pinned name before pinning is caught only by review and audit |
| T8 | **Misleading financial display** (float conversion, stale balances, local time-zone shifts) (T) | Amounts stay decimal strings; formatting checked digit for digit with a string fallback; lint bans number conversion; business dates in UTC; balances never summed; quotes and offers carry `finapp`'s expiry and terms hash | `tests/eslint-guards.test.ts` "money never becomes a JavaScript number"; `src/design-system/money.test.ts`; `status-and-dates.test.ts` | — |
| T9 | **Tipping off** - a screen revealing a risk, screening or credit-policy reason (I) | Status maps word holds and refusals with no reason (INV-RSK-08); credit declines show only `finapp`'s customer reasons (INV-CRD-04); no score, bucket or threshold is ever rendered | `move-money.test.tsx`, `fx-crossborder.test.tsx`, `credit.test.tsx` (no risk, score or bucket text) | Depends on `finapp` putting only customer text in `reasons[]` |
| T10 | **Clickjacking** of a confirm control (T) | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | Headers asserted by the browser checks (`checks.ts`, start page) | — |
| T11 | **Malicious link from `finapp` data** - a bank approval URL (S) | Only `https:` links are followed; nothing from a response becomes HTML | `move-money.test.tsx` "only an https approval link is ever followed"; credit `isHttpsLink` | A compromised provider could still send an https phishing page; the link is shown as the bank's, not followed automatically |
| T12 | **Secrets left behind** on a shared device (I) | Passwords, setup keys and the checkout code live in page memory only and are cleared once used; sign-out forgets the session even if the network fails; idle warning and expiry | `security.test.tsx` (password and key forgotten); `self-service.test.tsx` (nothing typed left on screen) | Browser memory until the tab closes; the browser's own password manager is the customer's choice |

## What only `finapp` can close

G-04 (HttpOnly cookie carrier - T1, T2), G-15 (edge route, headers and `no-store` on `/v1` - T4, T10 in production),
G-03 (recovery and contact verification), G-20 (a checkout hand-over that keeps the code out of URLs), G-22 (atomic
"sign out all other devices" - a session started during the page's loop survives it). See `FINAPP_BACKEND_WORK.md`.

## Not yet verified

A penetration test and a ZAP baseline need a staging deployment of the edge route (`P18-TSK-037`, blocked by G-15).
Nothing here has been exercised against a running `finapp`.
