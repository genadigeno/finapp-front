# finapp backend work for the Customer Application — Phase 18

**For:** the `finapp` backend team. **From:** `finapp-front-end`. **Written:** 2026-11-19 by `P18-DOC-001`, when the owner
approved the blueprint's decisions D-A…D-H ("Approve all"). What is listed here is the work only `finapp` can do. Nothing here
is scheduled in `finapp` yet: each item enters `finapp`'s backlog, under its process and its DoD profiles, when the owner
schedules it there (D-G names G-04, G-15 and G-03 as P0).

**Read against:** `finapp` `master` at `5227f57e2`. Every file reference below is relative to the `finapp` repository's root
unless it says `finapp-front-end`.

**How the Customer Application picks up a change:** a change to `docs/api/openapi.json` reaches it when it re-pins
(`P18-TSK-002`: `contract:pull`, `contract:generate`). A change that only adds a refusal (a step-up, a rate limit) needs
nothing here: the application already answers every problem document by its `code`.

## Summary

| # | Work | Gap | Task | Priority | Blocks |
|---|---|---|---|---|---|
| B0.1 | Phase 18 in `finapp`'s own records | — | — | At `P18-INIT` | The phase opening |
| B0.2 | Adopt ADR-F02 in `finapp`'s register | G-04 | `P18-TSK-101` | **P0** | B1.1 — **done** (ADR-0156) |
| B1.1 | Cookie session carrier and CSRF defence on the public surface | G-04 | `P18-TSK-101` | **P0** | Stage 2 — **done** (`X-TSK-029`) |
| B1.2 | Public-edge route, headers and deployable for `finapp-customer-web`; `no-store` on customer API | G-15 | `P18-TSK-102` | **P0** | Stage 2 |
| B1.3 | Notification delivery for verification and recovery tokens | G-03 | `P18-TSK-103` | **P0** | Recovery and e-mail verification screens |
| B2.1 | Customer standing on `GET /v1/me` | G-08 | `P18-TSK-104` | P1 | Standing-based routing |
| B2.2 | Personal data capture | G-07 | `P18-TSK-105` | P1 | Profile completeness |
| B2.3 | Test-only seeding for the customer E2E | — | — | P1 | Stage 2 acceptance |
| B2.4 | KYC checks are never run in production | G-16 | `P18-TSK-113` | **P0** | Any customer reaching APPROVED; every money journey after it |
| B2.5 | A read of the customer's own second factor | G-17 | `P18-TSK-114` | P2 | Showing two-step verification as on or off |
| B3.1 | Cursor pagination and missing customer lists | G-01 | `P18-TSK-106` | P1 | Stage 3–4 lists |
| B3.2 | Customer activity read | G-02 | `P18-TSK-107` | P1 | Dashboard, history |
| B3.3 | Contract quality | G-14 | `P18-TSK-108` | P1 | Typed statuses |
| B3.4 | A read of the currencies finapp holds | G-18 | `P18-TSK-115` | P3 | Offering only what finapp supports without a copy in the client |
| B4.1 | Browser card tokenisation | G-10 | `P18-TSK-109` | P2 | Card top-up |
| B4.2 | Idempotency on `POST /v1/beneficiaries` | G-12 | `P18-TSK-110` | P2 | Beneficiary creation |
| B4.3 | A browser path to the providers' linking grants | G-19 | `P18-TSK-116` | **P1** | Linking a bank account; adding an overseas recipient |
| B5.1 | Checkout hand-over from a shop; the shopper's view of the purchase before paying | G-20 | `P18-TSK-117` | **P1** | Paying a shop without typing a code; seeing the amount before paying |
| B5.2 | Customer lists of credit checks and applications; a read of offered amendments | G-21 | `P18-TSK-118` | P2 | Following a check or application after leaving its page; accepting an amendment |
| B6.1 | MFA factor removal and recovery codes | G-11 | `P18-TSK-111` | P2 | MFA management |
| B6.2 | Support and complaints; BNPL dispute read | G-13 | `P18-TSK-112` | P3 | Support screens |
| B6.3 | Sign out every other session at once | G-22 | `P18-TSK-119` | P3 | An atomic "sign out all other devices" |
| B7.1 | A human merchant session for a merchant portal | G-23 | `P18-TSK-120` | P2 | Any merchant ("client") screen in a browser |
| B7.2 | Keep staff and ledger identifiers out of customer views | G-24 | `P18-TSK-121` | P2 | Data minimisation; offering amendments safely |
| E1 | Downloadable statements; receiving identifiers | G-05, G-06 | — | P3 | Nice-to-have |
| E2 | Organisation members, mandates, "act as organisation" | G-09 | epic | P3 | Business banking |

---

## B0.1 — Phase 18 in `finapp`'s records

`finapp`'s roadmap and `CURRENT_STATE.md` do not name Phase 18. When the owner sequences it (after Phases 16 and 17, keeping
the one-phase-`IN_PROGRESS` rule), `finapp`'s records gain the phase and the backend tasks below, pointing to
`finapp-front-end/docs/PHASE_18_PLAN.md`. No status changes before then. *Since Stage 7:* the customer-web boundary is
drafted in `finapp-front-end/docs/THREAT_MODEL_CUSTOMER_WEB.md` for `finapp`'s `THREAT_MODEL.md` (`P18-TSK-036`).

## B0.2 — Adopt ADR-F02 in `finapp`'s register

`finapp-front-end/docs/adr/ADR-F02-cookie-session-carrier-on-the-public-surface.md` amends ADR-0030 and concerns `finapp`'s
code. `finapp` writes it as its own `ADR-NNNN` (next free number at the time), with ADR-F02 cited as its source, and records the
CSRF decision in the semgrep baseline as `finapp-spring-csrf-disabled`'s message asks
(`infra/semgrep/rules/spring.yml`). If `finapp` declines, say so: the Customer Application falls back to the in-memory token.

**Done (2026-11-21):** adopted as ADR-0156, "the customer session in an HttpOnly cookie", under `X-TSK-029` (pulled forward
from Phase 18 by the owner), in `finapp`'s DECISIONS.md. See B1.1 for the commits.

## B1.1 — Cookie session carrier and CSRF defence (G-04)

> **Adopted (2026-11-21), checked in `finapp`'s code and records.** `X-TSK-029`, gated `COMPLETE`: implementation
> `fff6aed21`, gate `25da140af`, on master at `5b31d6821` (ADR-0156). As built, it differs from the request below in three ways.
> (1) The cookie is `__Host-fa_session` with `Path=/`, `Secure`, `HttpOnly`, `SameSite=Strict` and no lifetime of its own.
> (2) The check needs `X-Finapp-Request: 1` and an `Origin` in `finapp.session.cookie.allowed-origins`. That list is empty on
> a deployed instance until it is set, so it fails closed; the deployed public origin is owed with B1.2.
> (3) The refusal is `403 identity.CsrfRejected` (ERROR_CONTRACT.md; API_CONVENTIONS.md §8b).
> This application uses it: the dev server opts in, `restoreSession` reads `GET /v1/sessions` at start-up (ADR-F02, commit
> `ef00e9a`), and the problem catalogue words `identity.CsrfRejected` as "not accepted, still signed in, reload and try
> again", never as a signed-out session. Still owed on `finapp`'s side: the threat-register entry, auditing and metering the
> refusals (ADR-0156 follow-up), and the contract's `securitySchemes` (G-14). The pinned contract here (`5227f57e`) predates the
> new code; it is worded ahead of the next re-pin, and the change is additive.

**Where:** `app/src/main/java/com/finapp/app/session/SessionAuthenticationInterceptor.java`;
`app/src/main/java/com/finapp/app/authentication/AuthenticationController.java` (sign-in, step-up);
`app/src/main/java/com/finapp/app/session/SessionController.java` (sign-out, revoke current); password change.

**What** (ADR-F02 §Decision):
1. On the `public` surface only (`X-Finapp-Surface: public`), accept the token from cookie `fa_session`; refuse a request
   carrying both a bearer header and the cookie.
2. When the request opts in (`X-Finapp-Session-Carrier: cookie`), sign-in, step-up and password change answer
   `Set-Cookie: fa_session=…; HttpOnly; Secure; SameSite=Strict; Path=/v1` and omit `sessionToken` from the body; without the
   header, today's response exactly.
3. Rotation replaces the cookie; `DELETE /v1/sessions/current` clears it (`Max-Age=0`).
4. For every unsafe method authenticated by the cookie: require `X-Finapp-Request: 1` and an `Origin` equal to the public
   origin; refuse otherwise with `403` and a code of its own (proposed `identity.CsrfRejected`) in `ERROR_CONTRACT.md`.
5. Never accept the cookie on the operator surface.
6. Document in `API_CONVENTIONS.md` and the contract (`securitySchemes`: `bearerAuth` and `cookieAuth`).

**Acceptance:** tests for cross-site form post, cross-origin fetch without the header, a foreign or missing `Origin`, the
cookie on the operator surface, both carriers at once, rotation on step-up and password change, sign-out clearing the cookie,
revocation from another session refused at the next request; existing bearer behaviour unchanged (the console's suite green).
**DoD:** `DOD-SEC`, `DOD-API`.

## B1.2 — Public-edge route, headers and deployable (G-15)

Mirror X-TSK-020, which hosts the console on the operator edge (`deploy/console/**`, `deploy/edge/base/operator-edge.yaml`
`finapp-console` service and `console-headers`, `ConsoleHostingManifestsTest`, `edge.rego` `[edge-console-headers]`).

**What:**
1. `deploy/customer-web/{base,overlays/kind,overlays/staging,overlays/production}`: namespace `finapp-customer-web`,
   nginx-unprivileged on 8080, read-only root, two or more replicas, no egress, NetworkPolicy ingress from the public edge only,
   resource quota.
2. `deploy/edge/base/public-edge.yaml`: a `finapp-customer-web` service and a `customer-web-headers` middleware carrying the
   CSP of ADR-F07, copied from `finapp-front-end/config/customer-web-headers.mjs` (written by `P18-TSK-009`), plus HSTS,
   nosniff, no-referrer, frame-deny; no `Cache-Control` (nginx sets it per path).
3. `deploy/edge/base/public-routes.yaml` (generated by `app/src/test/java/com/finapp/app/api/EdgeAllowListTest.java`): a
   router for `GET /` and `GET /assets/**` and the SPA's deep links to `finapp-customer-web`, at a lower priority than the
   `/v1/**` allow-list; no API route changes.
4. `Cache-Control: no-store` on every customer API response (as the operator path has).
5. `deploy/admission/clusterimagepolicies.yaml`: admit the customer-web image by signature; `deploy/delivery/{staging,
   production}/applications.yaml`: its Argo CD application; registry repository.
6. A hosting manifests test and an `edge.rego` rule holding the headers to the generated string.

**Acceptance:** kind E2E serves the SPA and `/v1/me` from one origin; the CSP header equals the generated string; no API route
reaches nginx; nginx reaches nothing. **DoD:** `DOD-SEC`, ops.

## B1.3 — Notification delivery for verification and recovery (G-03)

**Where:** `identity/src/main/java/com/finapp/identity/RecoveryService.java` (returns the token "for a notifier that does not
exist yet") and `ContactChannelService.java` (the challenge "is delivered nowhere, and that is a seam").

**What:** a notifier port in the platform with a simulated adapter (recording deliveries for test and kind, as the simulated
providers do), attached where the seams already are, in the same transaction or by outbox. Uniform responses preserved (no
enumeration). No token in logs (`RESTRICTED-PII`).

**Acceptance:** recovery and e-mail verification complete end to end on kind through the simulated adapter; responses identical
for known and unknown identifiers. **DoD:** `DOD-SEC`. *(No owning phase today; the owner assigns one.)*

*Confirmed by Stage 6:* recovery also needs its request identifier delivered - `POST /v1/recoveries` answers 202 with
no body, and the `{id}` of `/v1/recoveries/{id}/completion` appears only in the internal `identity.RecoveryInitiated`
event. Contact channels are e-mail only, have no read (no `GET /v1/me/channels`) and no removal. The application offers
neither recovery nor contact addresses until this lands. *Confirmed at finapp c8ffee5a4 (end-user map):* still no notifier;
also, a verified e-mail can never be replaced (409 `identity.VerifiedChannelAlreadyExists`), so "change my e-mail" needs
its own door after delivery lands.

## B2.1 — Customer standing on `GET /v1/me` (G-08)

**Where:** `app/src/main/java/com/finapp/app/profile/MeController.java`, party module. **What:** add party kind and customer
status (and, optionally, a list of required actions the backend decides: verify contact, enrol MFA, complete KYC, accept
consent version). The client derives navigation from it (ADR-F06) and never infers it. **DoD:** `DOD-API`.

## B2.2 — Personal data capture (G-07)

Legal name, date of birth, address and phone: decide where they live (party or KYC) by an ADR, then expose customer read and
update with `RESTRICTED-PII` handling. **DoD:** `DOD-API`, `DOD-SEC`.

## B2.3 — Test-only seeding for the customer E2E

Two seeded customers (for ownership-swap tests), one organisation registrant, a seeded MFA secret, wallets in EUR, JPY and a
3-decimal currency, and a fault-injection hook for "response lost after commit" (blueprint §17 scenario 5). Test profile
only; never in production images. Model: the console's B2.1.

## B2.4 — KYC checks are never run in production (G-16) *(found by Stage 2, 2026-11-19)*

**Where:** `kyc` module - `VerificationRunService.runChecks` is the only transition out of `OPEN`, and nothing in
production calls it (only tests); a provider callback can complete only checks already dispatched
(`THREAT_MODEL.md` notes it). **Effect:** a customer's case stays `OPEN` however many documents they add; no customer
can reach `APPROVED`, so nothing that needs a verified customer (wallets, money movement) can be used by anyone who
onboards through the application. **What:** dispatch the checks when a case has what it needs (documents, consent) -
an event handler or a schedule in the owning module, under the multi-instance rules - and let the simulated provider
answer. The application already shows every status finapp reports and needs no change. **DoD:** `DOD-API`, `DOD-SEC`.

## B2.5 — A read of the customer's own second factor (G-17) *(found by Stage 2)*

No customer read says whether a factor is enrolled (`GET /v1/me` does not; enrolment answers only the act). The
application therefore offers two-step verification without ever marking it on. **What:** `mfaEnrolled` (and, later,
the factor kind) on `GET /v1/me`, or a `GET /v1/me/mfa` with no secret in it. Relates to G-11. **DoD:** `DOD-API`.

## B3.1 — Cursor pagination and missing customer lists (G-01)

Implement `API_CONVENTIONS.md` §7 (`{items, nextCursor}`) on customer lists, and add list endpoints for withdrawals, FX trades,
cross-border payments and credit applications. Each in its owning module. **DoD:** `DOD-API`.

## B3.2 — Customer activity read (G-02)

A per-wallet activity read (transfers, payments, withdrawals, FX, cross-border, loan movements) with references to the
originating operation, likely derived from ledger statements; owner decided by an ADR (ledger or accounts).
*Found by Stage 3:* `GET /v1/transfers` lists only transfers the customer **sent** (incoming money appears only as
CREDIT lines on the statement) and carries no account ids; statement lines carry the operation id as `reference` but
no description or counterparty; no list exists for withdrawals, FX conversions or cross-border payments. **DoD:**
`DOD-API`, `DOD-FIN`.

## B3.4 — A read of the currencies finapp holds (G-18) *(found by Stage 3)*

finapp holds money in EUR, GBP, USD, JPY and BHD (`ledger` `SupportedCurrencies`) and offers no read of them; the
application keeps a copy (`src/modules/accounts/labels.ts`) and `accounts.UnsupportedCurrency` remains the authority.
**What:** `GET /v1/currencies` (or the list on an existing reference read) with each code and its scale. **DoD:** `DOD-API`.

## B3.3 — Contract quality (G-14)

In `docs/api/openapi.json`: `securitySchemes` and per-operation `security`; status fields as `enum`s; each operation's problem
codes listed; the two webhook routes the contract omits. Non-breaking. **DoD:** `DOD-API`. *Confirmed at finapp c8ffee5a4
(end-user map):* the contract still declares no security, so merchant-key routes, operator acts on customer-looking paths
(`POST /v1/payments/{id}/refund` and `/void`, `POST /v1/transfers/{id}/reversal`) and session routes look alike in the
generated client. The omitted webhook routes are `POST /v1/providers/fx/webhooks` and
`POST /v1/providers/payments/corridor/webhooks`; `GET /v1/operator/transfer-reversals/{id}` is missing too.

## B4.1 — Browser card tokenisation (G-10)

How a browser tokenises a card for the simulated PSP (hosted fields or a tokenisation endpoint) and the CSP consequence
(`frame-src`); an ADR in paymentmethods. Until then, top-up by saved method only. *Confirmed by Stage 4:* `POST
/v1/me/payment-methods` takes a `clientToken` only, and the tokenisation URL is "absent in every environment until a real
provider exists" - attaching answers `503 paymentmethods.TokenisationUnavailable`. **DoD:** `DOD-SEC`.

## B4.3 — A browser path to the providers' linking grants (G-19) *(found by Stage 4)*

`POST /v1/me/payment-methods/bank-accounts` takes a rail provider's single-use linking `grant`, and
`POST /v1/me/cross-border/beneficiaries` a corridor provider's tokenisation `grant` - bank details go to the provider,
never to finapp (ADR-0080 §3). Nothing in finapp tells a browser how to obtain either grant (a hosted page, a widget,
a redirect with a return URL), so no customer can link a bank account or add an overseas recipient from the
application. **What:** per provider, the browser flow that yields the grant - typically a redirect to the provider with
a finapp-issued state and a return route on the public edge - and its CSP consequence (`form-action`, `frame-src`),
by ADR. Relates to G-10 (cards). *Also found:* every provider URL (tokenisation, pay-in, push rail) is unset by
default (`CONFIGURATION_REGISTER.md`), so top-up confirmation and withdrawals answer `503 payments.ProviderUnavailable`
outside the test overlay; the application explains that answer. **DoD:** `DOD-SEC`.

## B5.1 — Checkout hand-over and the shopper's view of the purchase (G-20) *(found by Stage 5)*

A shopper reaches finapp's checkout with the `sessionToken` the shop received from `POST /v1/checkout/sessions`. It is a
bearer secret that must travel only in a request body, never in a URL (`CredentialReachesNoEmittedSinkTest`), and
finapp defines no hand-over from the shop's site to the customer application and no return to the shop (ADR-0053 has
none). The application therefore asks the customer to type the code in. Nor can the shopper read the session before
paying - `GET /v1/checkout/sessions/{id}` is the merchant's - so the amount and description are shown only in the
confirmation's answer; the pay-later options show the plan's illustration. **What:** by ADR, a hand-over that keeps
the token out of URLs (for example a short-lived, single-use hand-over reference the shop exchanges server to server,
or a form POST to a public-edge route that stores the token in the session), a shopper read of the session by token
(amount, currency, line summary, shop name, expiry) before paying, and a return URL registered per merchant.
**DoD:** `DOD-API`, `DOD-SEC`.

## B5.2 — Customer lists of credit checks and applications; offered amendments (G-21) *(found by Stage 5)*

There is no `GET` list for `/v1/me/credit/decision-requests`, `/v1/me/loan-applications` or
`/v1/me/bnpl-applications`: a customer who leaves a check or application's page has no way back to it (the credit
profile lists decisions only once decided). An offered loan amendment (`GET /v1/me/loans/{id}/amendments/{aid}`) can be
read only by its identifier, which nothing gives the customer (the notifier is G-03), so amendments are not offered in
the application. **What:** bounded, newest-first lists of the customer's own checks and applications with their
status; the loan read (or a list) names amendments awaiting the customer. **DoD:** `DOD-API`.

## B4.2 — Idempotency on `POST /v1/beneficiaries` (G-12)

Require `Idempotency-Key` as on other customer commands. **DoD:** `DOD-API`.

## B6.1 — MFA factor removal and recovery codes (G-11)

Remove or replace a factor under step-up; recovery codes issued once and stored hashed. *Confirmed by Stage 6:* the MFA
controller has only `POST /v1/me/mfa` and `POST /v1/me/mfa/confirmation`; recovery keeps the factor. **DoD:** `DOD-SEC`.

## B6.3 — Sign out every other session at once (G-22) *(found by Stage 6)*

There is no door that ends every session but the caller's; bulk revocation happens only as a side effect of a password
change (others) or a recovery (all). The application ends each other session in turn (`DELETE /v1/sessions/{id}`),
which is not atomic: a session started meanwhile survives. **What:** `DELETE /v1/sessions/others` (or equivalent),
revoking in one transaction, audited. **DoD:** `DOD-SEC`.

## B6.2 — Support and complaints; BNPL dispute read (G-13)

A new capability; until it exists the application shows no support screen (D-H). *Confirmed by Stage 5:* the only
dispute reads are under `/v1/merchant/` and `/v1/operator/`; a customer sees a dispute only in the answer to opening
or withdrawing it, which is where the application shows it. **DoD:** `DOD-API`.

## B7.1 — A human merchant session for a merchant portal (G-23) *(found by the end-user map, 2026-11-20)*

**Where:** `MerchantKeyAuthenticationInterceptor.java` and ADR-0052 decisions 1-4. Every `/v1/merchant/**` door (profile,
payable, payouts, transactions, card disputes and evidence, pay-later purchases, refunds and disputes) and checkout
session creation authenticate a **merchant API key** only: operator-issued, no expiry, `Bearer <keyId>.<secret>`. There
is no human merchant user, no merchant role a person holds (`MERCHANT_ADMINISTRATOR` is a staff role), and no session
a browser could carry. A merchant portal in a browser would have to hold the key - a long-lived secret the brief forbids
in the browser. **What:** merchant users (people) bound to a merchant, with their own sessions, roles (view, refund,
payout, dispute) and step-up for money acts, on a merchant surface separate from the customer one. Until then the
application offers no merchant screen; merchants integrate server to server. **DoD:** `DOD-SEC`, `DOD-API`.

## B7.2 — Keep staff and ledger identifiers out of customer views (G-24) *(found by the end-user map)*

`OfferedAmendmentView` (`GET /v1/me/loans/{id}/amendments/{aid}`) wraps `AmendmentView`, which since P17-TSK-116
carries `proposedBy` - the actor id of the member of staff who proposed it. `TransferView` carries `journalEntryId` and
`reversalEntryId`, unlike `PaymentView`, whose comment keeps ledger ids out of customer views. The application never
shows or logs them; finapp should not send them. **What:** customer-specific views without staff actor ids or ledger
identifiers. **DoD:** `DOD-SEC`.

## E1, E2 — Epics

- **G-05, G-06:** downloadable statements (PDF) and customer-visible receiving identifiers; Stage 3 works without them.
- **G-09:** organisation members, mandates and "act as organisation" — a new `authorization` module per ADR-0031's split
  trigger. Business banking beyond registration and KYB waits on it. *Found by Stage 2:* a registrant can only name an
  owner by the owner's party id, which nothing lets them look up; the owner has to read it off their own home page and
  pass it on. Owner invitation belongs to this epic.
