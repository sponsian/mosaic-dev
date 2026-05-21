# syntax=docker/dockerfile:1.6
#
# Mosaic dev-frontend — Railway web service.
# Multi-stage: build the SPA with Node, serve with nginx on $PORT.

# ---- builder ----
FROM node:16-bullseye AS builder

ENV NODE_OPTIONS=--max_old_space_size=4096 \
    CI=true \
    YARN_ENABLE_IMMUTABLE_INSTALLS=true

WORKDIR /app

# Yarn 3.5.1 is pinned via packageManager + .yarn/releases. Corepack picks it up.
RUN corepack enable

# Copy the whole monorepo. The dev-frontend has a file: dep on .yalc/@mosaic/chicken-bonds,
# and lib-ethers builds from compiled contract artifacts — selective copying is brittle here.
COPY . .

RUN yarn install --immutable

# Build only what the frontend needs. Subgraph (graph-cli) and contract tests are skipped.
RUN yarn prepare:contracts \
 && yarn prepare:lib-base \
 && yarn prepare:providers \
 && yarn prepare:lib-ethers \
 && yarn prepare:lib-react \
 && yarn workspace @mosaic/dev-frontend build

# ---- runtime ----
FROM nginx:1.25-alpine AS runtime

# Default for local `docker run`; Railway overrides this with its injected PORT.
ENV PORT=8080

# The base image's default server block listens on :80 — drop it so our template wins.
RUN rm -f /etc/nginx/conf.d/default.conf

# nginx:1.x runs envsubst over /etc/nginx/templates/*.template at boot and writes
# the result into /etc/nginx/conf.d/. enable_gzip.conf is copied as-is.
COPY packages/dev-frontend/etc /etc

# Generates /usr/share/nginx/html/config.json from TESTNET_ONLY, WALLET_CONNECT_PROJECT_ID, etc.
COPY packages/dev-frontend/docker-entrypoint.d /docker-entrypoint.d

COPY --from=builder /app/packages/dev-frontend/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
