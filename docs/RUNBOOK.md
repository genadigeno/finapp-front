# Runbook — FinApp for customers (`finapp-customer-web`)

**Task:** `P18-TSK-039` (DoD 1.11). Written 2026-11-19 at Stage 7, for the application as built in this repository.
Parts that depend on `finapp`'s deployment (the public edge route, G-15; the cookie carrier, G-04) are marked.

## 1. What runs

A static single-page application: `index.html`, content-hashed files under `/assets/`, served by
`nginxinc/nginx-unprivileged` (pinned by digest, `Dockerfile`) as user 101 on port 8080, read-only, with no secret, no
credential, no data and no outbound connection. Every API call goes from the customer's browser to the same origin,
`/v1/**`, which the public edge routes to `finapp` (blueprint §16.1). nginx answers 404 for `/v1/` - if it ever sees
one, the edge route is wrong.

| Path | Served by | Cache |
|---|---|---|
| `/`, every page address | nginx: `index.html` | `no-cache` (a release is picked up on the next load) |
| `/assets/*` | nginx: hashed files | `public, max-age=31536000, immutable` |
| `/v1/**` | the edge, to `finapp` | `no-store` - `finapp`'s to set (G-15) |

Responses are gzip-compressed by nginx (`config/nginx.conf`; without it the first load misses the LCP budget). Security
headers - CSP with Trusted Types, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, HSTS - are set by
the edge's `customer-web-headers` middleware from `config/customer-web-headers.mjs` (copied into `finapp`'s
`deploy/edge` by B1.2); nginx adds only `nosniff`.

## 2. Configuration

| Setting | Where | Values | Note |
|---|---|---|---|
| `VITE_SESSION_CARRIER` | build argument (`Dockerfile`) | `memory` (default), `cookie` | `cookie` only once `finapp` ships G-04; a build with `cookie` against a `finapp` without it cannot sign anyone in |
| `FINAPP_BACKEND_URL` | development only (`vite.config.ts` proxy) | URL | never in an image |

Nothing else is configured at run time: the same image runs in every environment.

## 3. Release and rollback

1. CI (`.github/workflows/ci.yml`) runs `npm run verify` - pins, licences, contract, audit, typecheck, lint, format,
   tests, build, bundle scan - and the browser checks (`npm run test:catalogue`: the component catalogue, the
   signed-in sweep of every page and the performance budgets).
2. CI builds the image from the lockfile as an OCI archive with its CycloneDX SBOM. It is not pushed or signed here:
   signing, admission and the Argo CD application are `finapp`'s delivery (B1.2), which deploys it by digest.
3. **Rollback** is the previous image digest. The application holds no state, so nothing is migrated or restored.

**A release while customers have the application open.** An open tab keeps running the old release. When it opens a
page it has not loaded yet, it asks for that page's old file; if the new image no longer has it, the page shows "This
page could not be shown" with "Try again" (`RouteError`), and reloading picks up the new release. The in-memory
session ends on a reload, so the customer signs in again. *Recommendation:* keep the previous release's `/assets/`
available for at least one release (for example by serving both from a shared volume or the CDN) - not done today.

## 4. Telling whether it is healthy

- `GET /` answers 200 with `Content-Security-Policy` containing `require-trusted-types-for 'script'`.
- A page address such as `GET /home` answers 200 with the same document (deep links are served by `index.html`).
- `GET /v1/anything` answers from `finapp`, never from nginx (a 404 with nginx's body means the edge route is wrong).

There is no client telemetry collector yet: the telemetry transport discards events until a first-party collector
is chosen (blueprint §16; no paid service without the owner's approval). Customer reports carry the **correlation
reference** shown on every result and error - it is `finapp`'s `X-Correlation-Id`, and finds the request in `finapp`'s
logs.

## 5. Failure behaviour (DR)

The application keeps no data, so disaster recovery is `finapp`'s. What a customer sees when something fails:

| Failure | What the customer sees | Evidence |
|---|---|---|
| A `finapp` module answers 503 or is overloaded | That page says the service is temporarily unavailable and nothing was changed; the rest of the application works | `accounts.test.tsx` "a module that is unavailable is said to be, and the rest works" |
| A read fails transiently | Retried with jittered backoff, then explained with "Try again" | `src/platform/api/retry-policy.test.ts` |
| A money command gets no answer (timeout, connection lost, 5xx after sending) | "We did not get a final answer" - check before sending again; "send the same request again" re-sends with the SAME idempotency key, so it can never be applied twice | `command.test.ts`; each journey's unknown-outcome test |
| `finapp` asks for a second factor | The code dialog, then the same request again with the same key | journey tests ("steps up …") |
| The session expires or is revoked (401 on a read) | Signed out, back to sign-in, returned to the page afterwards when it is a returnable page | `security.test.tsx` "a 401 on any read ends the session" |
| The customer is idle | A warning before the session ends, then sign-out | `SessionExpiring` (`States.tsx`), session-store tests |
| The connection drops | "You are offline"; commands disabled; nothing sent or queued; recovers by itself | `src/app/resilience.test.tsx` |
| The browser's clock is wrong | Quote and offer countdowns run on `finapp`'s clock (from the `Date` header) | `src/platform/api/server-clock.ts` |
| A new release while the tab is open | See §3 | `app.test.tsx` "anything else is explained, with a way to try again" |
| nginx or the edge is down | Nothing loads; the browser's own error. Nothing was sent | — |
| `finapp` fails over to another region | Requests in flight may end as "no final answer" (above); afterwards the application continues - it has nothing to restore | — |

## 6. Incidents

| Symptom | First check | Likely cause |
|---|---|---|
| Blank page, console shows a CSP or Trusted Types violation | The edge's `customer-web-headers` against `config/customer-web-headers.mjs` | Headers changed at the edge, or a release that broke the CSP (the browser checks should have caught it) |
| Every page says "This page could not be shown" | Whether `/assets/<file>` of the current `index.html` answers 200 | Partial deploy; `index.html` cached somewhere it should not be |
| Customers signed out on every action | `finapp`'s session store; the edge passing `Authorization` | `finapp` incident, or the edge stripping the header |
| "This is temporarily unavailable" on one module | That module in `finapp` | `finapp` incident; the rest of the application keeps working |
| Top-up confirmation and withdrawals say payments are unavailable | `finapp`'s provider configuration | Provider URLs unset (expected outside the test overlay - Stage 4 record) |
| Every credit application says "not available" | `finapp`'s active lending / BNPL terms | Expected in production: no active terms (Stage 5 record) |

## 7. Not yet in place

The edge route and its headers in a deployed environment (G-15), a staging deployment, a client telemetry collector,
and keeping the previous release's assets. Until G-15 lands nothing here has run behind the real edge.
