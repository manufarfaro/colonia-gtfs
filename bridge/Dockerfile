# syntax=docker/dockerfile:1.7
# Bridge AVL → GTFS-Realtime — NestJS sobre Node 26 (Alpine).
#
# Multi-stage:
#   1. build: compila TypeScript a dist/
#   2. runtime: solo dist/ + node_modules de producción

ARG NODE_IMAGE=node:26.1.0-alpine3.23

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY bin/healthcheck.js ./bin/healthcheck.js

# Default — overridable per environment.
ENV BRIDGE_PORT=3001
EXPOSE 3001

CMD ["node", "dist/main.js"]
