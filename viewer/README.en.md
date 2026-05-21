# `viewer/` — Next.js app (viewer + API routes)

[Español](README.md) · **English**

Single Next.js 16 app (App Router) that combines the two viewer-side responsibilities of the v0 stack: the mobile-first UI mimicking Google Maps Transit, and the API routes that orchestrate OTP + the bridge for the client. It is the only container in the stack that exposes a port to the host.

[![Viewer](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer.yml)
[![Viewer Smoke](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer-smoke.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer-smoke.yml)

## Stack

- **Next.js 16.x** (App Router, standalone output) + **React 19** + **TypeScript**.
- **shadcn/ui** + **Tailwind CSS v4** (CSS-first config, base color `neutral`).
- **next-intl** for type-safe i18n (locales declared in `i18n/routing.ts`; single `es` locale in v0).
- **next-themes** for the light/dark toggle with `prefers-color-scheme` + persistence.
- **axios** as the HTTP client for OTP and the bridge.
- **gtfs-realtime-bindings** to decode the protobuf feed from the bridge.
- **zod** for request body validation in route handlers.
- **@vis.gl/react-google-maps** as a React wrapper for the Google Maps JS API — used by the O→D mode (canvas + Places Autocomplete + encoded-polyline decoding).
- **vitest** + **@testing-library/react** + **happy-dom** for tests (TDD discipline; see `test/`).

Node pin: **26.x** (aligned with the bridge). `engines.node` in `package.json`.

## Boot

```bash
# 1. Make sure data/output/gtfs.zip exists (OTP and the bridge need it):
uv run --directory tooling python scripts/build_gtfs_zip.py

# 2. Bring up the full stack (viewer + otp + bridge):
docker compose up viewer
```

The viewer is reachable at `http://localhost:${VIEWER_PORT:-8080}`. OTP and the bridge are only reachable via Docker's internal network.

### Dev mode

```bash
cd viewer
npm install
npm run start:dev   # next dev on :3000 with hot-reload
```

In dev mode you still need OTP and the bridge running (via `docker compose up otp bridge`) and the URLs exported:

```bash
export OTP_BASE_URL=http://localhost:8081     # if OTP is exposed via compose.override.yml
export BRIDGE_BASE_URL=http://localhost:3001  # if the bridge is exposed via compose.override.yml
npm run start:dev
```

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | O→D mode — full-bleed Google Maps canvas, search bar with Places Autocomplete biased to Colonia, itinerary card in a bottom sheet. If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, an "API key missing" banner renders in place of the map (chrome + endpoints stay functional). |
| `/api/plan` | POST | Multi-modal itinerary. Zod body: `{from:{lat,lon}, to:{lat,lon}, date, time}`. Translates to OTP GraphQL. Each leg returns `legGeometry: { points: string } | null` (Google encoded polyline); each itinerary returns `fare: { regular: { cents, currency } } | null` (null → client falls back to "Consultar al chofer"). |
| `/api/stops/:stopId/arrivals` | GET | Upcoming arrivals. `?limit=10` query (clamped to 1..50). Mixes scheduled + realtime data from OTP. |
| `/api/lines/:lineId` | GET | Full line payload (shape + directions + stops + scheduledDepartures). 60-second TTL cache keyed by `(lineId, date)`. |
| `/api/lines/:lineId/vehicles` | GET | Live vehicles for the line, decoded from the bridge's `vehicle-positions.pb`. No cache. |
| `/api/tickets` | GET | `501 not_implemented` (reserved for v0.1+). |
| `/api/pois` | GET | `501 not_implemented` (reserved for v0.1+). |
| `/api/healthz` | GET | Aggregate stack health (viewer + otp + bridge). `ok` / `degraded` / `down`. |

Standardised errors: `400 invalid_request`, `404 *_not_found`, `502 otp_unavailable`. Internal OTP/bridge URLs never appear in error bodies (sanitisation in `lib/otp/client.ts` and `lib/bridge/client.ts`).

## Persistent chrome

`app/layout.tsx` wraps every page in `NextIntlClientProvider` + two components that live on every route:

- **`components/chrome/Header.tsx`** — Sticky top bar with the app title and the `LocaleSwitcher` (visual no-op while `locales.length === 1`).
- **`components/chrome/DisclaimerBanner.tsx`** — Persistent banner showing the PRD §5.2 copy. No dismiss button — disclaimers are first-class UI elements, not errors to hide.

## i18n

Single locale in v0 (`es`), but the `next-intl` plumbing is set up so adding `en.json` / `pt.json` later is purely additive:

- `i18n/routing.ts` declares `locales: ['es']`, `defaultLocale: 'es'`.
- `i18n/request.ts` resolves messages per request.
- `messages/es.json` carries the seed keys (`chrome.*`, `landing.*`). Every user-facing string goes through `t("...")` from day one — adding languages requires no refactor.

Operator toponyms (stop names, headsigns) are **not** translated — they live in `data/*.txt` in Spanish always.

## O→D mode (the main screen)

The root route (`app/page.tsx`) serves the O→D mode: the user picks origin + destination via Places Autocomplete (biased to Colonia urbano via bbox and `country: 'uy'`), the client posts `/api/plan` with `date`/`time` anchored to `America/Montevideo` (+1 minute margin), and the first itinerary renders on the Google map with polylines colored per line (`3=red`, `4=blue`, `5=green`, `8=amber`; walks are gray dashed) plus markers at the bus legs' boarding/alighting stops. The bottom sheet card shows total duration, walking distance, the legs list (walk / bus + destination), and the fare.

Four explicit states — copy lives in `messages/es.json` under the `od.*` namespace: `idle` (hint to pick origin/destination) · `loading` (skeleton) · `success` (itinerary + card) · `error.otp_unavailable` · `error.invalid_request` · `error.empty` (no routes found).

### Google Maps API key

The O→D mode needs a Google Cloud key exposed via `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Next.js bundles it to the client thanks to the prefix). Security is **not** about hiding the key — it's about an **HTTP referrer restriction** configured in the GCP Console:

1. Create or reuse a GCP project, enable Maps JavaScript API + Places API.
2. Create an API key.
3. In the key's "Application restrictions" section: pick "HTTP referrers (websites)" and add the demo's domain plus `http://localhost:8080/*` for dev.
4. In "API restrictions": allow only Maps JavaScript API + Places API.
5. Copy the key into `.env` (gitignored) as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`.

Without the key, the O→D mode renders an "API key missing" banner instead of the map. All endpoints + chrome stay functional.

## CORS

`middleware.ts` (workspace root) applies CORS headers to `/api/*` when the `VIEWER_CORS_ORIGINS` env lists explicit origins (comma-separated). Empty string → no CORS exposure; `"*"` → ignored with a warning (client and BFF share the same origin in v0).

## Tests

`npm test` runs the full vitest suite. TDD discipline: every handler / translator / utility is paired with a co-located `*.test.ts`. Deterministic fixtures live under `test/fixtures/otp/` (GraphQL JSON) and `test/fixtures/bridge/` (`vehicle-positions.pb` generated by `generate.mjs`).

## Healthcheck

`bin/healthcheck.js` is a pure-Node probe (the `node:26-alpine` image has no `curl`/`wget`). It opens a TCP socket against `/api/healthz`, parses the JSON, and considers the container healthy when `status` is `ok` **or** `degraded` (same principle as the bridge — `degraded` is still a live container, just without RT).

## CI

- **[`viewer.yml`](../.github/workflows/viewer.yml)** — lint + vitest + `next build` on every PR touching `viewer/**`.
- **[`viewer-smoke.yml`](../.github/workflows/viewer-smoke.yml)** — boot the full stack (otp + bridge in fixture mode + viewer), poll `/api/healthz`, hit `/api/plan`, `/api/lines/4`, `/api/lines/4/vehicles`, and assert the disclaimer copy appears in the HTML of `/`.

## Spec

The verifiable contract lives at [`openspec/specs/viewer-shell-and-api/spec.md`](../openspec/specs/viewer-shell-and-api/spec.md) (after the change is archived). While in-flight: [`openspec/changes/viewer-shell-and-api/`](../openspec/changes/viewer-shell-and-api/).
