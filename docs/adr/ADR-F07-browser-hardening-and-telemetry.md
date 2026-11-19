# ADR-F07 — Browser hardening: a strict CSP with Trusted Types, a storage policy, an allow-listed telemetry schema

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: ADR-0019, ADR-0072, ADR-C131, `DATA_CLASSIFICATION.md`, `INV-AUD-02`, `CUSTOMER_APP_BLUEPRINT.md` §12.6, §15, §16;
`P18-DOC-001`.

## Context

With ADR-F02 the token is out of JavaScript's reach, but injected script could still act through the open session. Data classes
`RESTRICTED-PII` and `RESTRICTED-FINANCIAL` never appear in logs, traces, metrics or events. Browser storage persists beyond the
session and is readable by any script on the origin.

## Decision

1. **Content security policy** on the document, served by the public edge's `customer-web-headers` middleware and generated
   from `config/customer-web-headers.mjs`:
   `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self';
   form-action 'self'; base-uri 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'`.
   Plus `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, a restrictive
   `Permissions-Policy`, HSTS at the edge. A payment provider's `frame-src` is added only by its own ADR (G-10).
2. **Injection sinks are banned by lint**: `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
   `document.write`, `eval`, `new Function`, string timers. Each rule is proven to fail by a guard test.
3. **Zero CSP violations** in the catalogue and E2E runs under the production policy; a violation fails the run.
4. **Storage policy**: no token, API data, amount, identifier or personal data in `localStorage`, `sessionStorage`,
   IndexedDB, cookies set by script, or URLs. One allow-listed `localStorage` key holds preferences (language, theme). No
   service worker caches API responses. Enforced by lint and a test.
5. **Telemetry by allow-list**: events carry only fields named in a schema (route id, event kind, problem `code`, correlation
   id, timings, Web Vitals). No request bodies, headers, amounts, identifiers classified `RESTRICTED-*`, or free text. A spy
   transport test proves it. No third-party analytics; no paid error-reporting service without the owner's approval.
6. **API responses** on customer routes carry `Cache-Control: no-store` (G-15).
7. **Post-sign-in return** is restricted to an allow-list of in-app route ids (no open redirect).

## Alternatives Considered

### Nonce-based CSP
Cons: needs a server rendering each document; static hosting cannot.

### Third-party analytics / RUM
Cons: sends behavioural data off-origin; requires consent and a processor agreement. Not in R1.

## Consequences

Positive: script injection is constrained to nothing; data at rest in the browser is nil.
Negative: every library must work under Trusted Types and without inline styles; some are excluded by this alone.
Operational impact: headers owned by the public edge (`finapp`), generated from this repository's config.
Security impact: the main defence against session riding (ADR-F02's residual risk).
Financial impact: none.

## Invariants / Constraints

- The production CSP is never relaxed to make a component work.

## Follow-up

- `THREAT_MODEL.md` gains a customer-web boundary at Stage 7.
