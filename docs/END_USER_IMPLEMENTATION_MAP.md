# End-user implementation map

What finapp offers the people who use it - customers, business customers, shoppers and merchants ("clients") - what
this application already does with it, what it can build now, and what waits on finapp. Made on 2026-11-20 (D-R) from
finapp's code and documents at `c8ffee5a4`; every claim was checked against the code by a second, adversarial reader.

## How it was made

- **Contract.** This application pins finapp's contract at `5227f57e`. finapp has 77 commits since; they add 105
  operations, every one operator or ledger. No customer-facing operation changed except `AmendmentView`
  (see G-24), so the pin stays.
- **Coverage.** Of finapp's 135 non-operator operations, the application calls 91. The other 44 were read one by one.
- **Research.** Four readers (identity and self-service; clients and merchants; money; credit) read the controllers,
  the services behind them (authorisation, ownership, step-up, idempotency, state machines) and finapp's documents
  (CAPABILITY_MAP, ADRs, THREAT_MODEL, ERROR_CONTRACT). A skeptic per domain tried to refute every claim. A last reader
  compared every controller in `finapp/app` with the map. All claims below survived. 
- **The rule for "build now".** A signed-in customer's browser can do it end to end with its own session, every
  identifier it needs is one the customer can obtain, nothing secret or long-lived reaches the browser, and finapp - not
  the application - enforces that the customer sees only their own data.

## Who uses finapp, and how

| Person | How finapp knows them | In this application |
|---|---|---|
| Customer | A personal session (password, optional TOTP step-up) | Yes - everything below |
| Business customer | A customer who registered an organisation (`/v1/me/organisations`, `/v1/me/kyb`) | Registration and KYB only; acting for the organisation waits on G-09 |
| Shopper | A customer paying a shop (checkout confirmation, pay later) | Yes, with a typed code; the hand-over and a preview wait on G-20 |
| Merchant ("client") | **A machine API key only** - operator-issued, never expires (ADR-0052). No person, no session | **No.** A browser would have to hold the key. New gap G-23 |
| Staff | Operator sessions with permissions, four eyes | The admin console, never here |
| Providers | Signed webhooks | Never a browser |

## Already built (91 operations)

Registration, sign-in and step-up, sign-out, sessions, password change, two-step enrolment, profile name, consents,
identity check, business registration; wallets, balances, statements, activity; send money, recipients, top-up, card
and bank methods (reads), withdrawals, exchange, send abroad; credit checks, loans and credit lines (schedule, repay,
payoff, draw, close, statements), pay later (agreements, repay, payoff, disputes), paying a shop. Stages 2-6 of
`PHASE_18_PLAN.md` record each.

## Build now (D-R work packages)

Each item lists what finapp gives and the conditions the skeptics attached. Conditions common to all: amounts are the
decimal strings finapp sends, never floats or client-made totals; ids live in memory and in in-app paths only, never
storage, logs, analytics or redirect targets; customer free text (references, nicknames) is plain text; one neutral
"not found" for missing, malformed and not-yours; unknown statuses read "in progress", never "paid".

### WP-1 Money: receipts, refunds, a restricted account (modules `accounts`, `move-money`)

| Item | finapp | Conditions |
|---|---|---|
| Transfer receipt | `GET /v1/transfers/{id}` - owner-checked in SQL; the 201 answer and the list carry the id | Re-read on every view (an operator can reverse a completed transfer later; only the read shows it). Show a reversal as its own dated line, never netted. No ledger ids. No retry from a receipt. Do not link statement lines to it (their reference format is not contract) |
| Refunds on a payment | `PaymentView.refunded`, `refundPending` (already read) | Show what finapp reports; nothing derived |
| Restricted account | Account status `SUSPENDED`; `409 accounts.OutflowSuspended` on withdrawal, wallet payment, exchange and send abroad; a transfer ends `FAILED` (finapp ADR-0153, after the pin) | A notice on the account, no reason (finapp gives none). Keep every entry point: finapp decides each command under its lock. A refusal is final - a later attempt is a new intent with a new key |

### WP-2 Exchange and send abroad: receipts and the agreed figures (module `fx-crossborder`)

| Item | finapp | Conditions |
|---|---|---|
| Conversion receipt | `GET /v1/me/fx/conversions/{tradeId}` - owner-checked; id from the convert answer | Re-read on every view (`REVERSED` after an operator reversal). `bookedOn` is a plain date, never through `new Date()`. Rate and amounts exactly as returned |
| What you agreed, on a payment abroad | `GET /v1/me/cross-border/quotes/{quoteId}`, the id from the payment read | Read once, no polling. The payment's status comes only from the payment read, never the offer's. If the read fails, show no figures. A returned payment may come back less a fee - say so, point to the statement |
| Who it went to | `GET /v1/me/cross-border/beneficiaries/{beneficiaryId}` | Nickname as plain text, the suffix finapp gives, status words only - never a reason |

### WP-3 Credit: what was really paid (module `credit`)

| Item | finapp | Conditions |
|---|---|---|
| Repayment history status | `status` `ALLOCATED` / `REVERSED`, `kind`, `allocations[]` on loan and pay-later repayments | **A reversed repayment is shown as reversed and never counted as paid** - today it looks paid. Re-read history after every command (a replayed receipt keeps its first status) |
| Statement detail (credit lines) | `status` `PAID` / `DUE` / `PARTIALLY_PAID`, `paid`, `outstanding`, fees and interest billed, interest waived | finapp's figures only |
| Repay a closing credit line | Repayment and payoff are allowed on a `CLOSING` line | Offer repay and payoff for `ACTIVE`, and for a `CLOSING` line; draw and close only for `ACTIVE`. finapp's refusal stays the guard |
| Schedule billing detail | Loan instalment `billing` (interest, principal, fees billed, paid, outstanding, waived); pay-later instalment `billed`, `billedFees` | Explain why "due" can exceed the instalment (late fees) |
| Account condition | `condition.defaulted`, `bucket`; `payoutStatus` | Show a default as a fact; never say "paying into your wallet" when a payout status says otherwise |
| Why a check or application closed | `closureReason` on credit checks and pay-later applications | Our own words per reason; never finapp's English text |
| Interest built up (pay monthly) | `balances.interestAccrued` | As returned |

### WP-4 Security centre (module `security`)

| Item | finapp | Conditions |
|---|---|---|
| Sign out all other devices, honestly | `GET /v1/sessions` after the loop | Never claim "all signed out" until a fresh read shows only this device; if one appeared meanwhile, say so and offer again. Point to a password change for a suspected compromise - it ends every other session in one step |
| Session expiry | `idleExpiresAt`, `absoluteExpiresAt` | Device text stays plain text |
| Authenticator period | `periodSeconds` on enrolment | Shown only for the manual key; never logged |

### Shared (done first): wording for codes customers can receive

`accounts.OutflowSuspended`, `payments.WalletPaymentUnfunded`, `fx.QuoteNotCancellable`, `crossborder.OfferNotFound`,
`crossborder.ProviderUnavailable`, `credit.DataStale`, `lending.LoanWrittenOff` - each in finapp's `ERROR_CONTRACT.md` and
until now answered with a generic message. New status presentations: repayment (`REPAYMENT_STATUS`) and statement
(`STATEMENT_STATUS`).

## Not adopted

- `GET /v1/me/accounts/{id}/balance` - a legacy one-currency read; `/balances` is complete.
- `GET /v1/me/fx/quotes/{id}` as a page - the quote lives only while the customer exchanges; the convert replay under
  the same key stays the authority after an unclear answer.

## Waits on finapp

| Capability | Why not now | Gap |
|---|---|---|
| Merchant portal: transactions, payable, payouts, card disputes and evidence, pay-later refunds and disputes, checkout sessions | Merchant API key only; no person or session | **G-23** (new) |
| Password recovery; contact e-mail | No notifier delivers the tokens; the recovery id is never returned; a verified e-mail cannot be replaced | G-03 |
| Two-step status, removal, recovery codes | No read; no removal; no codes | G-17, G-11 |
| Atomic "sign out everywhere else" | No door | G-22 |
| Personal details; customer standing | Display name only; no status on `/v1/me` | G-07, G-08 |
| Link a bank account; add an overseas recipient; external loan payout | No browser path to the providers' linking grants | G-19 |
| Add a card | No browser tokenisation | G-10 |
| Full history, paging, withdrawal / exchange / abroad lists | No paging, no lists, no activity read | G-01, G-02 |
| Loan amendments | The customer can obtain the amendment id nowhere; the view carries a staff id | G-21, **G-24** (new) |
| Lists of credit checks and applications | No lists | G-21 |
| Pay-later dispute read | Merchant and operator reads only | G-13 |
| Shop hand-over and preview | No token-safe hand-over, no shopper read | G-20 |
| Acting for an organisation | No members or mandates | G-09 |
| Passkeys | finapp's capability map names them; only TOTP exists | not built in finapp |
| Refund, void, reversal on customer-looking paths | Staff permissions, step-up, four eyes | never here |

Production also originates no credit until a lending and pay-later terms version is active: applications answer
`*.ProductNotOffered`, which the application already explains.

## Corrections made to this repository's records

- `CUSTOMER_APP_BLUEPRINT.md` marked loan amendments "Ready"; they are blocked (G-21).
- `MfaPage.tsx` cited G-11 for "no read of the factor"; it is G-17.
- The accounts labels said nothing produces `SUSPENDED`; finapp now does.
