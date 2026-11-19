# ADR-F04 — Money, rates and dates in the browser: strings in, `Intl` out, no arithmetic

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: ADR-0009, `API_CONVENTIONS.md`, `CUSTOMER_APP_BLUEPRINT.md` §13; `P18-DOC-001`.

## Context

`finapp` returns amounts as decimal strings with an ISO 4217 currency, balances as `{kind: PROJECTION, settled, holds,
available}`, rates as decimal strings, percentages as basis points, business dates (`postingDate`, `valueDate`, due dates) as
dates without a time zone, and instants in UTC. Every amount the customer sees is computed by the backend: balances, fees,
FX amounts, interest, schedules, payoff amounts. A browser that converts a decimal string to a binary float can display an
amount the ledger never held.

## Decision

1. **Amounts stay strings end to end**, paired with their currency. They are never converted to `number`.
2. **Formatting** uses `Intl.NumberFormat(locale, {style: 'currency', currency})` on the string (ES2023 string input),
   with a string-split fallback where the engine lacks it (verified in `P18-TSK-005`). The scale comes from the currency's
   minor units (JPY 0, EUR 2, BHD 3).
3. **Input** (`MoneyInput`) is string-in, string-out, validated against the currency's scale; the backend validates again.
4. **Rates** are displayed exactly as returned. **Basis points** are formatted by integer string arithmetic.
5. **Balances** show available prominently and settled and holds labelled; the client never sums or derives them, and labels
   the number `PROJECTION` per ADR-0009.
6. **Business dates** render as given, never through `new Date()`. **Instants** render in the customer's zone with an
   explicit zone label on receipts.
7. **Lint bans** `parseFloat`, `Number(...)` and unary `+` on money-named values, and floating-point formatting of amounts;
   each rule is proven to fail by a guard test.
8. **No money library by default.** `big.js` may be added only for a non-authoritative preview the owner approves.

## Alternatives Considered

### dinero.js / big.js for display arithmetic
Pros: exact decimal arithmetic. Cons: invites the client to compute what the backend owns. Not needed for display.

### Minor-unit integers
Cons: the backend does not send them; a conversion is itself arithmetic.

## Consequences

Positive: the screen shows only what the ledger holds.
Negative: no client-side totals or previews; a summary the customer wants must come from the backend.
Operational impact: none. Security impact: none. Financial impact: removes a class of display errors.

## Invariants / Constraints

- Never in the frontend: balances, fees, FX amounts, interest, schedules, payoff amounts, eligibility, credit decisions,
  statuses.

## Follow-up

- Exhaustive scale tests (0/2/3, negatives, very large values) in `P18-TSK-005`.
