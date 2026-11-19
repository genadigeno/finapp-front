# finapp-front-end — FinApp Customer Application

The customer-facing web application of the FinApp programme (Phase 18): registration, identity verification,
multi-currency wallets, money movement, credit and self-service for individuals and business registrants, on the
customer surface of the `finapp` modular monolith.

**State:** Stage 1 (foundation) is built: a gated, empty shell with the platform, design system and catalogue every
later stage builds on. There are no customer journeys yet: sign-in and onboarding are Stage 2, and need `finapp`'s
P0 work first (`docs/FINAPP_BACKEND_WORK.md`).

## Commands

Node 22.14 (`.node-version`) and npm 11; installs come from the lockfile only.

| Command | What it does |
|---|---|
| `npm ci` | Install exactly the lockfile |
| `npm run dev` | Vite on http://localhost:5180, proxying `/v1` to finapp (`FINAPP_BACKEND_URL`, default `http://localhost:8080`) |
| `npm run verify` | Every gate: pins, licences, contract, typecheck, lint, format, tests, build, bundle scan and budget |
| `npm test` | Unit, component and lint-guard tests (Vitest) |
| `npm run test:catalogue` | Builds the catalogue and the application for production and runs axe and the CSP in a browser (Playwright). Without the pinned Chromium, `PW_CHANNEL=msedge` (or `chrome`) uses an installed browser |
| `npm run check:reproducible` | Builds twice and requires byte-identical output |
| `npm run contract:pull -- ../finapp <ref>` then `npm run contract:generate` | Re-pins finapp's `docs/api/openapi.json` at a commit and regenerates the types |
| `npm run theme:generate` | Rewrites `src/design-system/theme.generated.css` after a theme change |
| `npm run sbom` | CycloneDX SBOM of the shipped dependencies |

**Build-time configuration:** `VITE_SESSION_CARRIER` is `memory` (default; the token in memory only, ADR-C131's
carrier) until finapp ships the HttpOnly cookie carrier (G-04), then `cookie` (ADR-F02).

## Layout

```
contract/        finapp's openapi.json pinned by commit + sha256 (SOURCE.json)
config/          customer-web-headers.mjs (the CSP and headers, one definition), nginx.conf
src/app/         providers, router and guards, step-up, banners, the two Stage 1 pages
src/platform/    api (client, ApiError, command runner, idempotency, problem catalogue), session, query,
                 i18n, telemetry (allow-list), preferences (the one storage key)
src/design-system/  theme, money and dates, value / state / workflow components, the shell
src/generated/   types generated from the contract (never edited)
catalogue/       every component on one page, for the axe and CSP run
e2e/catalogue/   the browser checks
tests/           gate and lint-guard tests
```

## Documents

| Document | Purpose |
|---|---|
| [`docs/CUSTOMER_APP_BLUEPRINT.md`](docs/CUSTOMER_APP_BLUEPRINT.md) | The approved architecture blueprint |
| [`docs/PHASE_18_PLAN.md`](docs/PHASE_18_PLAN.md) | Scope, governance, stages, Stage 1 in full and its record, threats, risks |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Every Phase 18 task, frontend and backend |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Owner decisions and the ADR index |
| [`docs/adr/`](docs/adr/README.md) | ADR-F01…F08 |
| [`docs/DEFINITION_OF_DONE.md`](docs/DEFINITION_OF_DONE.md) | `DOD-CUST` |
| [`docs/FINAPP_BACKEND_WORK.md`](docs/FINAPP_BACKEND_WORK.md) | What only `finapp` can do, for its backend team |

Related repositories: `finapp` (the backend and its contract), `finapp-admin-panel` (the Operator Console, Phase 17).
