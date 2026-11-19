# ADR-F03 — The customer frontend stack: Vite, React and TypeScript on Mantine with TanStack, no template, no paid dependency

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: ADR-C136; the owner's decision D-F (`CUSTOMER_APP_BLUEPRINT.md` §8, §20, approved 2026-11-19); `P18-DOC-001`.

> *Corrected 2026-11-19 by `P18-TSK-001` (a `Proposed` ADR may be corrected in place):*
> - *This ADR first read "every dependency MIT/Apache-2.0". The enforced rule is the licence policy in
>   `scripts/lib/licence-policy.mjs`, the console's: what ships may be MIT, Apache-2.0, ISC, BSD-2/3-Clause or 0BSD
>   (react-intl is BSD-3-Clause; tslib is 0BSD), with named exceptions only; tooling adds a few permissive licences;
>   copyleft and unknown licences fail the build.*
> - *Versions pinned at `P18-TSK-001` are the console's proven set (Mantine 9.8.0, TanStack Query 5.107.1, Router
>   1.170.46, TypeScript 6.0.3, Vite 8.3.8, Vitest 5.1.0, Playwright 1.65.0) plus react-intl 12.1.6 - each at least two
>   weeks old, newer releases deliberately not taken on their first days.*
> - *React Hook Form and Zod join with the first form (`P18-TSK-010`); nothing in Stage 1 needs them.*

## Context

The application must run under a strict content security policy (`style-src 'self'`, Trusted Types; ADR-F07), meet WCAG 2.2 AA,
format money from decimal strings, and stay maintainable by a small team that also maintains the console. No credible
open-source customer banking template exists (`CUSTOMER_APP_BLUEPRINT.md` §8.1); admin templates have the wrong audience and
AGPL projects are licence-incompatible.

## Decision

| Concern | Choice |
|---|---|
| Build / app | Vite 8, React 19, TypeScript strict (the console's pinned major) |
| Components | **Mantine 9** (MIT), with a customer design layer of its own: tokens, theme, value and state components |
| Routing | TanStack Router 1.x (typed search params; console parity) |
| Server state | TanStack Query 5, in memory only |
| API client | openapi-typescript 7 + openapi-fetch 0.17 over the pinned contract |
| Forms | React Hook Form 7 + Zod 4 (shape only, never business rules) |
| Messages | FormatJS (react-intl), ICU messages |
| Money arithmetic | none (ADR-F04) |
| Tests | Vitest, Testing Library, MSW (tests only), Playwright + axe |

- **Versions pinned exactly**, lock file committed, licences checked against an allow-list (the console's), `npm audit`
  policy, SBOM generated in CI. Versions are re-verified at `P18-TSK-001` against the registry, not taken from this ADR.
- **Mantine components that inject `<style>` at runtime are banned by lint**; theme variables are emitted as a generated
  stylesheet (the console's method, proven by its CSP browser test).
- **No template, no purchase, no paid service.**
- **Fallback:** React Aria Components + Tailwind 4 / CSS modules, if Mantine cannot meet CSP or accessibility needs.

## Alternatives Considered

### React Aria Components + Tailwind
Pros: best documented accessibility; no runtime CSS. Cons: more design-system work; no shared skills with the console.
Kept as the documented fallback.

### MUI, Chakra (Emotion runtime)
Cons: need nonces and `'unsafe-inline'` style attributes; incompatible with ADR-F07. MUI X Pro is commercial.

### Ant Design
Cons: CSP only in `zeroRuntime` mode; enterprise/admin look.

### shadcn/ui
Pros: MIT, good primitives. Cons: copied source is ours to own; Base UI needs a `CSPProvider`.

### Next.js
Rejected in ADR-F01.

## Consequences

Positive: tooling, lint guards and the CSP catalogue transfer from the console; one skill set.
Negative: a second Mantine theme to maintain; Mantine has no published screen-reader matrix, so manual screen-reader passes
are part of each stage.
Operational impact: static assets only.
Security impact: dependency surface reviewed by pins, licences, audit and SBOM.
Financial impact: none; every dependency MIT/Apache-2.0.

## Invariants / Constraints

- No dependency with a commercial tier in the critical path; no AGPL.
- No runtime style injection.

## Follow-up

- TypeScript 7 and `typescript-eslint` compatibility: follow the console's recorded deviation.
