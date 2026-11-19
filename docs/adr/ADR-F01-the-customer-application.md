# ADR-F01 — The Customer Application: a separate single-page application, served same-origin from the public edge, with no backend-for-frontend

Status: Proposed

Date: 2026-11-19

Phase: 18

Rests on: ADR-0001, ADR-0030, ADR-0120, ADR-0147, ADR-0151, ADR-C130; the owner's decisions D-B, D-C and D-E
(`CUSTOMER_APP_BLUEPRINT.md` §20, approved 2026-11-19); `P18-DOC-001`.

## Context

The owner asked for a customer-facing application for individuals and businesses. The brief assumed microservices behind an
API gateway and an OAuth authorization server. None exists:
- `finapp` is one modular monolith (`finapp-app`, N ≥ 3 replicas, one PostgreSQL writer). ADR-0151 keeps every module in it.
- There is no gateway. Two Traefik edges, public and operator, carry route tables generated from code by
  `EdgeAllowListTest` (ADR-0147). The edge stamps `X-Finapp-Surface` and authenticates nothing.
- The monolith already serves a customer surface: about 97 operations under `/v1/me/**`, `/v1/authentications`,
  `/v1/sessions`, `/v1/transfers`, `/v1/fx/**`, `/v1/cross-border/**`, `/v1/loans/**` and others.

The Operator Console (ADR-C130) is the precedent: a separate repository, a static SPA served same-origin through its edge, no
BFF, gaps closed in owning modules.

## Decision

1. **A separate repository.** `finapp-front-end` holds the Customer Application, its plan, backlog, ADRs and definition of
   done. `finapp` is Java/Gradle with its own gates; release cadence and supply chain differ (D-B).
2. **A static single-page application**, built by Vite, deployed as a fourth deployable `finapp-customer-web`
   (nginx-unprivileged, read-only root filesystem, no secrets, no egress, two or more replicas, image signed and admitted by
   digest).
3. **Same-origin through the public edge.** The public edge routes `GET /` and `/assets/**` to `finapp-customer-web` and
   `/v1/**` (its existing allow-list) to `finapp-app`. No CORS, no new origin, no new trust boundary inside the cluster.
4. **No backend-for-frontend and no gateway.** The browser talks to the monolith's customer surface directly. A BFF would hold
   sessions (a new stateful, multi-instance tier), duplicate the edge's rate limits and the monolith's authentication, and
   invite aggregation that belongs to owning modules (D-E).
5. **Gaps close in the owning module.** A missing customer read or command is a `finapp` task in the module that owns the
   data, listed in `FINAPP_BACKEND_WORK.md`. The client never simulates a missing capability.
6. **One application for individuals and business registrants** (D-C). Navigation adapts to the party kind and standing
   (ADR-F06). Business banking beyond registration and KYB waits for organisation members and mandates (G-09).

## Alternatives Considered

### A BFF holding the session (OAuth-style)
Pros: the token never reaches the browser; a place to aggregate.
Cons: there is no authorization server to talk to; a new stateful tier and session store contradicts ADR-0030 and the "no
Redis" posture; two places to revoke; aggregation would decide things the owning modules should. The one real benefit, keeping
the token from JavaScript, ADR-F02 delivers inside the monolith.

### Pages rendered by a Node server (Next.js)
Pros: server rendering, SEO.
Cons: a nonce-based CSP forces fully dynamic rendering; the Node tier becomes a second backend holding the session. The SEO need
is limited to static marketing pages, which are out of scope.

### Inside the console repository, or inside `finapp`
Pros: one repository fewer.
Cons: different audience, edge, carrier, design language and release cadence; the console's ADR-C130 set one repository per
frontend.

## Consequences

Positive: no new backend tier; the edge allow-list stays the single door; revocation, rate limits and authorization stay where
they are.
Negative: every missing capability waits for a `finapp` task; customer lists are unpaginated today (G-01).
Operational impact: one more deployable, NetworkPolicy and Argo CD application (G-15).
Security impact: the SPA holds no authority; every decision stays server-side.
Financial impact: none; the client computes no amount (ADR-F04).

## Invariants / Constraints

- The application never reaches PostgreSQL, Kafka, a management port or the operator edge.
- No screen claims a capability whose endpoint is missing.
- No mock data outside tests.

## Follow-up

- Revisit a BFF only if a native mobile application needs a materially different API shape.
- `P18-INIT` reviews this ADR against the code and accepts it.
