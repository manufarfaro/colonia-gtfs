# syntax=docker/dockerfile:1.7
# Viewer = Next.js app + API routes. Multi-stage build with standalone
# output for a slim runtime image.

ARG NODE_IMAGE=node:26.1.0-alpine3.23

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone build outputs everything we need in .next/standalone/
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY bin/healthcheck.js ./bin/healthcheck.js

ENV VIEWER_PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
