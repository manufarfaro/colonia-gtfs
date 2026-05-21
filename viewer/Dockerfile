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
# Next.js inlines NEXT_PUBLIC_* env vars into the client bundle at BUILD
# time, not runtime. The viewer reads `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
# in `app/page.tsx` to decide between the map canvas and the "API key
# missing" banner; without the value at build the server-rendered HTML
# permanently shows the banner even when the value is set at runtime.
# `NEXT_PUBLIC_VIEWER_DEFAULT_CENTER` is the same story.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_VIEWER_DEFAULT_CENTER
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
ENV NEXT_PUBLIC_VIEWER_DEFAULT_CENTER=${NEXT_PUBLIC_VIEWER_DEFAULT_CENTER}
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
# Next.js standalone server.js reads HOSTNAME + PORT from the env. Without
# them it binds to localhost:3000 — inside Docker that traps the listener
# inside the container's loopback, so the healthcheck (which probes
# localhost:8080) and the host port mapping both see "connection reset by
# peer". Pin them to the public bind + the v0 contract port.
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
