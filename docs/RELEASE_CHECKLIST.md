# Release checklist and exit review — Phase 18

**Task:** `P18-TSK-040`. **Reviewed:** 2026-11-19, at the end of Stage 7, against this repository's `master` and `finapp`
`5227f57e2`.

## Verdict

**Not ready for customers.** The application is built and its own gates pass, but it cannot serve a real customer
until `finapp` closes four P0 items, and three release checks need an environment or a person this phase does not
have. Nothing below is claimed as working end to end: no journey has run against a real `finapp`.

## 1. This repository

| # | Item | State | Evidence |
|---|---|---|---|
| 1 | `npm run verify`: pins, licences, contract, typecheck, lint (money, injection, storage, module rules), format, tests, build, bundle scan | **Done** | CI `verify` job |
| 2 | Builds byte-identical; SBOM; image as an OCI archive | **Done** | `check:reproducible`; CI `image` job |
| 3 | Browser checks: component catalogue, start and sign-in pages, every signed-in page (axe, CSP and Trusted Types, phone reflow) | **Done** | `npm run test:catalogue` |
| 4 | Performance budgets: first load ≤ 200 kB gzip, LCP ≤ 2.5 s, CLS ≤ 0.1, interactions ≤ 200 ms on a throttled phone | **Done** - 196 kB; LCP 2.19 s (12% headroom - it missed once at 2.77 s on a loaded machine before the start page joined the entry); CLS 0; slowest interaction 120 ms | `check:bundle`; `performance.spec.ts` |
| 5 | Threat model of the customer-web boundary | **Drafted** - adoption into `finapp`'s `THREAT_MODEL.md` is `finapp`'s | `THREAT_MODEL_CUSTOMER_WEB.md` |
| 6 | Runbook and failure behaviour | **Done** | `RUNBOOK.md` |
| 7 | Accessibility: automated WCAG 2.2 AA | **Done** | `ACCESSIBILITY_AUDIT.md` §1 |
| 8 | Accessibility: manual screen-reader passes | **Not done** - needs a person with the assistive technologies | `ACCESSIBILITY_AUDIT.md` §3 |
| 9 | Penetration test and ZAP baseline against staging (`P18-TSK-037`) | **Blocked** - no staging deployment of the edge route (G-15) | §3 below |
| 10 | End-to-end journeys against a real `finapp` (blueprint §17 mandatory scenarios) | **Not done** - the owner deferred pulling `finapp`'s container images ("Not now") | — |
| 11 | Responses compressed in production | **Done** at Stage 7 (`config/nginx.conf` gzip) - before it, the first load would have missed the LCP budget | `RUNBOOK.md` §1 |
| 12 | Client telemetry collector | **Not chosen** - events are discarded until a first-party collector is approved | blueprint §16 |
| 13 | Previous release's assets kept for open tabs | **Not done** - open tabs show "This page could not be shown" and recover on reload | `RUNBOOK.md` §3 |

## 2. `finapp` (handed off in `FINAPP_BACKEND_WORK.md`)

| Priority | Gap | Effect on release |
|---|---|---|
| **P0** | G-16 - KYC checks never run in production | No customer can be verified, so no one can open a wallet: every money journey is unreachable |
| **P0** | G-15 - public-edge route, headers and deployable | The application cannot be reached; also blocks staging and item 9 |
| **P0** | G-04 - cookie session carrier | The token stays in page memory (option A): a reload signs the customer out. The owner may choose to release with option A and record the cost (D-D) |
| **P0** | G-03 - notification delivery | No password recovery, no e-mail verification |
| P1 | G-19 linking grants, G-20 checkout hand-over, G-01/G-02 lists and activity, G-08 standing, G-14 contract enums | Journeys degraded as each stage record says |
| — | Credit and pay later have no active terms in production | Credit answers "not offered" (expected; a business decision) |

## 3. The ZAP baseline, once staging exists

Run OWASP ZAP's baseline (passive) scan against the staging origin and attach the report here:

```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://<staging-customer-origin>/ -I
```

Expected: no high or medium alert; the CSP, `frame-ancestors`, HSTS, `nosniff` and `Referrer-Policy` present on every
document. The penetration test (an external tester, scope: the customer-web boundary of
`THREAT_MODEL_CUSTOMER_WEB.md` and the `/v1` public surface) follows it.

## 4. Decisions waiting on the owner

| # | Decision |
|---|---|
| D-J | A QR library for two-step setup (a new shipped dependency) |
| — | Whether to release with the in-memory session (option A) if G-04 is late |
| — | Legal review: `finapp` sends no APR on credit offers (its decision L8); consumer-credit disclosure rules may require one (Stage 5 record) |
| — | Whether JAWS (licensed) is in the manual accessibility scope |
| — | A first-party telemetry collector |
| — | Revisit D-M's two choices: the typed checkout code, and Credit always in the navigation |

## 5. Exit review

Phase 18's frontend work - Stages 1 to 7 - is built in this repository with its gates passing; `finapp`, the console
and their phases are unchanged. The phase cannot exit to customers: its exit needs items 8, 9 and 10 above and the
four P0 gaps closed. When they are, re-run this checklist, attach the ZAP report, the penetration-test summary and
the manual accessibility notes, and record the release decision here.
