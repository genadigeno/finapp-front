# syntax=docker/dockerfile:1
# The finapp-customer-web image (ADR-F01 decision 2; P18-TSK-009): static, content-hashed assets served by a
# non-root nginx with no secret, no credential and no data. Base images are pinned by digest (ADR-F03) - the
# same digests the Operator Console's image uses. The security headers (CSP, Trusted Types, HSTS...) are the
# public edge's `customer-web-headers` middleware (ADR-F07; config/customer-web-headers.mjs is their single
# definition; FINAPP_BACKEND_WORK.md B1.2). Adapted from finapp-admin-panel/Dockerfile (ADR-F08).
#
# Not yet here (Stage 7, once a registry holds a release): carrying the previous release's hashed assets so a
# rolling update never answers an old page's asset request with a 404 - the console's deploy/previous-assets.

FROM node:22.14.0-alpine@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944 AS build
WORKDIR /src
# npm 11.4.2 - the version that writes the lockfile.
RUN npm install -g npm@11.4.2 --no-fund --no-audit
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts --no-fund --no-audit
COPY . .
# The session carrier is a build-time choice (ADR-F02): `memory` until finapp ships G-04, then `cookie`.
ARG VITE_SESSION_CARRIER=memory
ENV VITE_SESSION_CARRIER=${VITE_SESSION_CARRIER}
RUN npx vite build --logLevel warn
RUN node scripts/check-bundle.mjs dist

FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
COPY config/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
