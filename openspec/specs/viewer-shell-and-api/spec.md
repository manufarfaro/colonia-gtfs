## Purpose

Unified Next.js application for the v0 stack: a single public-facing service that combines the API surface (formerly proposed as a separate BFF) with the viewer shell that consumes it. Built on the App Router with React 19 and TypeScript, it exposes five JSON endpoints plus two documented stubs and an aggregate healthz that translate to/from [`otp-routing`](../otp-routing/spec.md) R-07 GraphQL and [`bridge-gtfs-rt`](../bridge-gtfs-rt/spec.md) R-05/R-07; it also renders the chrome persistente (branded header + non-dismissible disclaimer banner per PRD §5.2) and the `next-intl` i18n scaffolding (es-only in v0, additive for future locales per PRD §3.4 and §5.4). Covers the compose service definition (the only service in v0 with a host port mapping), the route handlers and their Zod-validated contracts, the in-memory line cache, the optional CORS opt-in, the CI lint+test+build workflow plus the end-to-end smoke workflow that boots the full stack against a committed AVL fixture, and the documentation (`viewer/README.md` + English mirror).

## Requirements

### Requirement: The repository SHALL declare a `viewer` service in `docker-compose.yml` as the single public entry point

The repo SHALL extend the root `docker-compose.yml` with a service named `viewer`, built from a `Dockerfile` under `./viewer/`. The service SHALL be the **only** service in the v0 stack with a host port mapping by default (`ports: "${VIEWER_PORT:-8080}:8080"`). All other services (`otp`, `bridge`) SHALL keep their internal-only access per their respective specs.

The service definition SHALL include `restart: unless-stopped`, the env file `.env`, a `healthcheck` block (see the healthz requirement), and `depends_on` with `condition: service_healthy` for both `otp` and `bridge` — so `docker compose up viewer` brings the full stack up in the correct order.

#### Scenario: Compose declares the viewer service with the public port mapping
- **WHEN** the repository is inspected and `docker-compose.yml` is read
- **THEN** the `viewer` service declares `ports:` mapping host port to container port `8080`, references `./viewer` as its build context, and lists `otp` and `bridge` in `depends_on`

#### Scenario: Viewer is the only public-facing service
- **WHEN** the base `docker-compose.yml` is inspected
- **THEN** neither `otp` nor `bridge` declares `ports:` mapping to the host; only `viewer` does

### Requirement: The viewer SHALL be a Next.js App Router app with chrome persistente and i18n infra

The `viewer/` workspace SHALL be a Next.js application using the App Router, React 19, and TypeScript. The root `app/layout.tsx` SHALL render chrome persistente across every page: a branded header and a disclaimer banner. The disclaimer banner SHALL be present on every page rendered by the app (it is not a dismissible overlay; per PRD §5.2 disclaimers are first-class).

The banner copy SHALL match the feed-publication state: "Datos preliminares · operador no oficial · horarios referenciales" (or an i18n key resolving to that string in Spanish).

The chrome SHALL render with the **Colonia institutional theme** — a coherent palette and typography pairing derived from the Intendencia de Colonia logo (`https://colonia.gub.uy/?x=logosDescargas&p=overall`), with both light and dark variants:

- **Primary anchor**: cobalt `#0077b5` (light) / lifted cobalt `#3aa8d8` (dark) — used for `--primary`, `--ring`, and the chrome title color when its `font-display` weight is active.
- **Secondary surface**: sky blue `#c8dff3` (light) / deep blue `#1a3b5c` (dark) — used for `--accent` and emphasis chips.
- **Destructive signal**: red `#e20a15` (light) / `#c41420` (dark) — reserved EXCLUSIVELY for destructive/critical states. The red SHALL NOT appear in decorative roles (no red shadows, no red borders for non-error states, no red badges for "live" / "active" indicators).
- **Light background**: warm cream `#fbfaf6` (a faint paper warmth) — cards lift to pure white `#ffffff`.
- **Dark background**: deep navy `#0a1721` (referencing the Río de la Plata at night) — cards lift to `#0f2030`.
- **Border radius**: `0.375rem` (6px) — institutional, not consumer-trendy.

Typography SHALL be wired via `next/font/google` (self-hosted at build, no runtime third-party DNS):

- `--font-display`: **Fraunces** (variable serif, OFL) — chrome title, headings, large numeric labels.
- `--font-body`: **IBM Plex Sans** (variable sans, OFL) — default body text.
- `--font-mono`: **IBM Plex Mono** (OFL) — line codes (`Línea 3`), stop IDs, scheduled departure times.

All three SHALL be subsetted to `latin` + `latin-ext` (covers Spanish accents and Portuguese for future locale expansion per PRD §3.4).

Every text-on-surface pairing in the theme SHALL pass WCAG 2.1 AA contrast (4.5:1 for body text, 3:1 for large text / UI components) in BOTH light and dark modes. The pairings audited at theme-palette adoption are recorded in the design document (see `design.md` D-09).

#### Scenario: Root layout includes chrome on every rendered page
- **WHEN** any page produced by the app is server-rendered
- **THEN** the HTML response includes the branded header and the disclaimer banner

#### Scenario: Disclaimer banner is not dismissible
- **WHEN** the rendered HTML or hydrated client view is inspected
- **THEN** the disclaimer banner has no close button, no `display: none` toggle, and persists across navigation

#### Scenario: Theme tokens carry the Colonia palette in light mode
- **WHEN** the chrome renders with the `light` theme active (no `.dark` class on `<html>`)
- **THEN** `getComputedStyle(document.documentElement).getPropertyValue('--primary')` SHALL resolve to the cobalt brand HSL (`200 100% 35.5%` or visually equivalent), AND `--background` SHALL resolve to the warm cream HSL (`45 30% 97%` or equivalent)

#### Scenario: Theme tokens carry the Colonia palette in dark mode
- **WHEN** the chrome renders with the `dark` theme active (`.dark` on `<html>`)
- **THEN** `--primary` SHALL resolve to the lifted cobalt HSL (`198 67% 54%` or equivalent), AND `--background` SHALL resolve to the deep navy HSL (`210 53% 8%` or equivalent)

#### Scenario: Typography variables are bound on the html element
- **WHEN** the layout renders
- **THEN** the `<html>` (or `<body>`) element SHALL carry CSS class names binding `--font-display`, `--font-body`, `--font-mono` to the Fraunces / IBM Plex Sans / IBM Plex Mono `next/font` instances respectively

#### Scenario: Chrome title uses the display font
- **WHEN** the header renders
- **THEN** the title element SHALL have the `font-display` Tailwind utility applied (or its computed `font-family` SHALL be `Fraunces, …`), differentiating it from the body copy

#### Scenario: Red is reserved for destructive states
- **WHEN** the viewer is in any state OTHER than an error / destructive condition
- **THEN** no element in the rendered DOM SHALL use `var(--destructive)` for `color`, `background-color`, `border-color`, or `box-shadow`

#### Scenario: WCAG AA contrast holds in both modes
- **WHEN** the chrome is rendered in either theme
- **THEN** each of the canonical text-on-surface pairings recorded in `design.md` D-09 SHALL pass WCAG AA (4.5:1 for body text, 3:1 for UI components) when measured via any standard contrast tool (e.g., `getContrast()` from `polished` or the browser DevTools accessibility audit)

#### Scenario: Reduced motion is honored
- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** the staggered shell-mount fade-in SHALL NOT play; the chrome and OD shell slots SHALL appear in their final position immediately

### Requirement: The viewer SHALL use `next-intl` for i18n with a single `es` locale in v0

The app SHALL be wired with `next-intl` (or an equivalent App-Router-native i18n library) so every user-facing string is accessed via a `t("key")` lookup (or `useTranslations()` / `getTranslations()` hooks). All v0 strings SHALL live in `viewer/messages/es.json`. The `i18n/routing.ts` config SHALL declare `locales: ['es']` and `defaultLocale: 'es'`.

Adding additional locales in v0.1+ SHALL be additive only: dropping `messages/en.json` (or `pt.json`) next to `es.json` and adding the locale to `routing.ts` SHALL be sufficient — no component code change is required.

A `LocaleSwitcher` component SHALL exist (even if it currently renders as a no-op or hidden because only one locale is available), so future locale additions wire it in without re-introducing the component.

#### Scenario: All v0 strings are catalog entries
- **WHEN** any TSX file under `app/` or `components/` is inspected
- **THEN** every user-facing literal string is either a translation key passed to `t(...)`/`getTranslations(...)` or an operator name (stop names, headsigns) which per PRD §3.4 stays in Spanish always

#### Scenario: Adding a locale requires no code changes
- **WHEN** a hypothetical `messages/en.json` is added and `locales: ['es', 'en']` is set in `i18n/routing.ts`
- **THEN** the build succeeds and the app renders the new locale without any component change

### Requirement: `POST /api/plan` SHALL accept Zod-validated bodies and translate OTP responses to a stable REST shape

The viewer SHALL expose `POST /api/plan` as an App Router route handler. The handler SHALL validate the body with a Zod schema; on validation failure it SHALL return `400` with `{ error: "invalid_request", details: [...] }`. Valid bodies SHALL match:

```json
{
  "from": { "lat": -34.4712, "lon": -57.8520 },
  "to":   { "lat": -34.4471, "lon": -57.8147 },
  "date": "2026-05-20",
  "time": "08:30"
}
```

The handler SHALL forward the request to OTP's GraphQL endpoint (`POST /otp/gtfs/v1`) and translate the response to a REST shape:

```json
{
  "itineraries": [
    {
      "durationSeconds": 2735,
      "walkDistanceMeters": 3637.5,
      "fare": { "regular": { "cents": 7500, "currency": "UYU" } },
      "legs": [
        {
          "mode": "WALK",
          "durationSeconds": 222,
          "distanceMeters": 293.31,
          "startTime": "2026-05-20T08:30:45.000Z",
          "endTime": "2026-05-20T08:34:27.000Z",
          "realtimeState": null,
          "route": null,
          "legGeometry": { "points": "_p~iF~ps|U_ulLnnqC" },
          "from": { "name": "Origin",      "lat": -34.4712, "lon": -57.8520, "stopId": null },
          "to":   { "name": "ITUZAINGO",   "lat": -34.4706, "lon": -57.8492, "stopId": "1:2" }
        }
      ]
    }
  ],
  "meta": { "queriedAt": "2026-05-20T11:30:00Z", "otpLatencyMs": 412 }
}
```

`itineraries[].legs[].legGeometry` SHALL be a Google encoded polyline string surfaced from OTP's `legGeometry { points }` GraphQL field, OR `null` when OTP did not compute it for that leg. The viewer SHALL forward the value verbatim — no decoding server-side.

`itineraries[].fare` SHALL surface the OTP `fare { regular { cents, currency } }` value when present in `fare_attributes.txt`, OR `null` when the GTFS fare data is absent. The handler SHALL NOT default a fare value when none is available — `null` is the deterministic signal for the client to render the fallback ("Consultar al chofer", per [`viewer-od-mode`](../viewer-od-mode/spec.md) R-04).

When OTP is unreachable (timeout, connection refused, HTTP 5xx) the handler SHALL return `502 { error: "otp_unavailable" }` and no internal OTP hostname or URL SHALL be surfaced in any field of the response.

#### Scenario: Valid body returns 200 with itineraries including legGeometry and fare
- **WHEN** the client posts a valid body and OTP responds with a plan that has at least one itinerary
- **THEN** the response is `200` with an `itineraries` array whose first entry has the shape above, each leg carries `legGeometry: { points: string } | null`, and the itinerary carries `fare: { regular: ... } | null`

#### Scenario: legGeometry survives leg-by-leg through the translator
- **WHEN** OTP's GraphQL response includes `legGeometry: { points: "<encoded>" }` for a leg
- **THEN** that same encoded string SHALL appear unchanged at `itineraries[i].legs[j].legGeometry.points` in the REST response

#### Scenario: Missing fare data surfaces as null
- **WHEN** the GTFS feed has no `fare_attributes.txt` row for the matched route and OTP returns no `fare` in its plan response
- **THEN** the REST response SHALL emit `itineraries[i].fare: null` (not omitted, not defaulted)

#### Scenario: Invalid body returns 400 with details
- **WHEN** the client posts a body missing `to.lon` or with a non-`YYYY-MM-DD` `date`
- **THEN** the response is `400` with `error: "invalid_request"` and a `details` array describing the failed fields

#### Scenario: OTP unavailable returns 502, sanitized
- **WHEN** the OTP call fails (timeout, ECONNREFUSED, HTTP 5xx)
- **THEN** the response is `502 { error: "otp_unavailable" }` and the body string SHALL NOT contain any OTP hostname, port, or URL fragment

### Requirement: `GET /api/stops/:stopId/arrivals` SHALL return next-bus arrivals merged from scheduled + realtime

The viewer SHALL expose `GET /api/stops/:stopId/arrivals` (with optional `?limit=<int>` query, default 10). For a known stop, the handler SHALL `POST` an OTP GraphQL query that resolves the next N scheduled arrivals at that stop including realtime updates. The translated response SHALL be:

```json
{
  "stop": { "id": "<string>", "name": "<string>", "lat": <number>, "lon": <number> },
  "arrivals": [
    {
      "lineShortName": "<string>",
      "headsign": "<string>",
      "scheduledArrivalIso": "<ISO-8601>",
      "expectedArrivalIso": "<ISO-8601>",
      "delaySeconds": <int>,
      "isRealtime": <boolean>
    }
  ],
  "meta": { "queriedAt": "<ISO-8601>", "realtime_available": <boolean> }
}
```

`meta.realtime_available` SHALL be `false` when no arrival in the response carries realtime data (i.e. the bridge is down or has stale data); the endpoint SHALL still respond `200 OK` with the scheduled arrivals.

Unknown stop IDs SHALL produce `404 Not Found`. OTP unreachable SHALL produce `502` (without OTP we cannot produce the scheduled list).

#### Scenario: Arrivals include both scheduled and realtime entries
- **WHEN** OTP has at least one realtime update for the queried stop
- **THEN** at least one entry in `arrivals` has `isRealtime: true` and a non-null `delaySeconds`; `meta.realtime_available` is `true`

#### Scenario: Arrivals fall back to scheduled-only when realtime is unavailable
- **WHEN** OTP has no realtime data (bridge unreachable or empty `.pb` feed)
- **THEN** every entry has `isRealtime: false`, the response is still `200 OK`, and `meta.realtime_available` is `false`

#### Scenario: Unknown stop returns 404
- **WHEN** the path parameter `stopId` does not match any stop in the static GTFS feed (per OTP's response)
- **THEN** the response is `404 Not Found` with `{ "error": "stop_not_found" }`

### Requirement: `GET /api/lines/:lineId` SHALL return route + shape + stops + today's schedule, cached 60 s

The viewer SHALL expose `GET /api/lines/:lineId` where `lineId` is one of `3, 4, 5, 8` (Sol Antigua urban lines per `gtfs-static-data`). The handler SHALL `POST` an OTP GraphQL query resolving the route, its encoded polyline shape, the stops on each direction, and the scheduled `stop_times` for the current operator-local date. The translated response SHALL be:

```json
{
  "line": { "id": "<string>", "shortName": "<string>", "longName": "<string>" },
  "shape": "<encoded polyline string>",
  "directions": [
    {
      "directionId": 0 | 1,
      "headsign": "<string>",
      "stops": [{ "id": "<string>", "name": "<string>", "lat": <number>, "lon": <number>, "sequence": <int> }],
      "scheduledDepartures": [{ "tripId": "<string>", "firstStopTimeIso": "<ISO-8601>" }]
    }
  ],
  "meta": { "queriedAt": "<ISO-8601>", "date": "<YYYY-MM-DD>" }
}
```

The response SHALL be cached in-memory by `(lineId, date)` with a TTL of 60 seconds — the data is static per service-day so frequent viewer navigations don't re-hit OTP.

#### Scenario: Line response includes shape and per-direction stop lists
- **WHEN** `GET /api/lines/4` is called on a weekday during service hours
- **THEN** the response is `200 OK` with `line.shortName: "4"`, a non-empty `shape`, and `directions` of length 2 (one per direction) each with a non-empty `stops` array

#### Scenario: Cache hit returns identical response
- **WHEN** the same `GET /api/lines/:id` URL is called twice within 60 s
- **THEN** the second call does not produce a new OTP query (verifiable via OTP access logs or test injection); the response body is byte-identical to the first

### Requirement: `GET /api/lines/:lineId/vehicles` SHALL decode the bridge's `.pb` and filter by line

The viewer SHALL expose `GET /api/lines/:lineId/vehicles`. The handler SHALL `GET ${BRIDGE_BASE_URL}/gtfs-rt/vehicle-positions.pb` (with a 5 s timeout, `responseType: 'arraybuffer'`), decode the body via `gtfs-realtime-bindings.transit_realtime.FeedMessage.decode`, filter the entities whose `vehicle.vehicle.label === "L" + lineId` (or whose `vehicle.trip.routeId === lineId`), and translate to:

```json
{
  "lineId": "<string>",
  "vehicles": [
    {
      "id": "<string>",
      "lat": <number>,
      "lon": <number>,
      "bearing": <number>,
      "speedMs": <number>,
      "lastSeenIso": "<ISO-8601>",
      "tripId": "<string> | null",
      "nextStopId": "<string> | null"
    }
  ],
  "meta": { "queriedAt": "<ISO-8601>", "realtime_available": <boolean>, "bridgeLatencyMs": <int> }
}
```

When the bridge is unreachable OR the decoded `FeedMessage.entity[]` is empty, `vehicles` SHALL be `[]` and `meta.realtime_available` SHALL be `false`. The response status SHALL be `200 OK` in both cases — the bridge being down is a degradation, not a viewer failure.

This endpoint SHALL NOT be cached server-side. The bridge URL SHALL NOT appear in any logged error.

#### Scenario: Vehicles filtered to the requested line
- **WHEN** the bridge's `.pb` contains 3 vehicles on line 4 and 2 on line 5, and `GET /api/lines/4/vehicles` is called
- **THEN** the response `vehicles` array has exactly the 3 line-4 vehicles

#### Scenario: Bridge unreachable returns empty list with realtime_available=false
- **WHEN** the bridge cannot be reached within the timeout
- **THEN** the response is `200 OK` with `vehicles: []` and `meta.realtime_available: false`

### Requirement: `/api/tickets` and `/api/pois` SHALL respond `501 Not Implemented` with a documented body

The viewer SHALL expose `GET /api/tickets` and `GET /api/pois`. Both SHALL respond `501 Not Implemented` with:

```json
{
  "error": "not_implemented",
  "message": "<endpoint> is a documented v0 stub; implementation deferred to a future spec.",
  "spec": "openspec/specs/viewer-shell-and-api/spec.md"
}
```

These stubs exist so consumers discover the endpoints with a self-explanatory `501` rather than a `404`. The PRD §6.1 lists both as documented v0 stubs.

#### Scenario: Tickets stub responds 501
- **WHEN** `GET /api/tickets` is called
- **THEN** the response is `501 Not Implemented` with the documented JSON body and the `spec` field pointing at this spec's canonical path

### Requirement: `GET /api/healthz` SHALL aggregate the status of the viewer, OTP, and bridge

`GET /api/healthz` SHALL respond `200 OK` with `Content-Type: application/json` and a body conforming to:

```json
{
  "status": "ok" | "degraded" | "down",
  "viewer": {
    "uptime_seconds": <int>,
    "node_version": "<string>",
    "next_version": "<string>"
  },
  "otp": { "reachable": <boolean>, "latency_ms": <int | null> },
  "bridge": {
    "reachable": <boolean>,
    "latency_ms": <int | null>,
    "downstream": { /* the bridge's own /healthz body, or null if unreachable */ }
  }
}
```

The aggregate `status` SHALL be:
- `"ok"` when `otp.reachable === true` AND `bridge.downstream.status === "ok"`.
- `"degraded"` when `otp.reachable === true` AND `bridge` is unreachable OR its `downstream.status` ∈ `degraded | down`.
- `"down"` when `otp.reachable === false`.

The endpoint SHALL probe OTP via `GET ${OTP_BASE_URL}/otp/actuators/health` (1 s timeout) and the bridge via `GET ${BRIDGE_BASE_URL}/healthz` (1 s timeout). Probes SHALL be made on each request (no background polling).

#### Scenario: All green when both upstreams are healthy
- **WHEN** OTP responds `200` to its actuator health and the bridge's healthz returns `status: "ok"`
- **THEN** `GET /api/healthz` returns `200` with aggregate `status: "ok"`

#### Scenario: Degraded when only the bridge is down
- **WHEN** OTP is reachable but the bridge times out
- **THEN** `GET /api/healthz` returns `200` with aggregate `status: "degraded"`, `bridge.reachable: false`, and `bridge.downstream: null`

#### Scenario: Down when OTP is unreachable
- **WHEN** OTP times out
- **THEN** `GET /api/healthz` returns `200` with aggregate `status: "down"` and `otp.reachable: false`

### Requirement: CORS SHALL be off by default and opt-in via `VIEWER_CORS_ORIGINS`

The viewer SHALL serve the frontend and the API routes from the same origin by default — CORS is unnecessary in production. When `VIEWER_CORS_ORIGINS` env var is unset or empty, no CORS middleware SHALL be mounted.

When `VIEWER_CORS_ORIGINS` is set to a comma-separated list of origins (e.g. `http://localhost:3000`), CORS handling SHALL be enabled for those origins. The value `*` (wildcard) SHALL NOT be honored — the viewer SHALL log a warning and skip CORS instead.

#### Scenario: CORS off by default
- **WHEN** the viewer boots with no `VIEWER_CORS_ORIGINS` env var
- **THEN** responses to `/api/*` do not include `Access-Control-Allow-Origin` headers

#### Scenario: CORS allows configured origins
- **WHEN** `VIEWER_CORS_ORIGINS="http://localhost:3000"` is set and a preflight `OPTIONS /api/plan` arrives with `Origin: http://localhost:3000`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:3000`

### Requirement: CI workflows SHALL lint, unit-test, and smoke-test the viewer end-to-end

Two GitHub Actions workflows SHALL exist:

- `.github/workflows/viewer.yml`: triggers on push/PR for `viewer/**` and the workflow file. Steps: checkout, setup-node (major matching `viewer/package.json` engines), `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- `.github/workflows/viewer-smoke.yml`: triggers on push/PR for `viewer/**`, `docker-compose.yml`, `data/*.txt`, `bridge/**`, `deployment/otp/**`, or the workflow file. Steps:
  1. Checkout.
  2. Setup Node 26 + Java 21 + uv.
  3. Build `gtfs.zip` via `tooling/scripts/build_gtfs_zip.py`.
  4. `docker compose -f docker-compose.yml -f compose.override.ci.yml up -d otp bridge viewer` with `ORIGIN_AVL=file://./bridge/test/fixtures/avl-sample.xml`.
  5. Poll `GET /api/healthz` until aggregate `status` ∈ `ok | degraded` (timeout 90 s).
  6. Issue requests to `POST /api/plan` (Buquebus → PdT canonical coordinates, pinned weekday+time), `GET /api/lines/4`, `GET /api/lines/4/vehicles`. Assert response shape and status.
  7. Render the root page (`GET /`) and assert the response HTML contains the disclaimer banner copy.
  8. Upload `smoke-out/` (responses, healthz body, viewer + otp + bridge logs) as an artifact via `actions/upload-artifact@v4` with `if: always()`.

The smoke workflow SHALL NOT reference `secrets.ORIGIN_AVL` — it uses the committed fixture, per the secret-handling contract inherited from `bridge-gtfs-rt` R-03.

#### Scenario: Lint+test workflow runs on viewer changes
- **WHEN** a pull request modifies any file under `viewer/app/` or `viewer/components/`
- **THEN** the `viewer` workflow runs `npm run lint`, `npm test`, and `npm run build`, and fails the build on any failure

#### Scenario: Smoke asserts both API and root page
- **WHEN** the smoke workflow boots the stack and calls `POST /api/plan` plus `GET /` against the viewer
- **THEN** the plan response is `200 OK` with at least one itinerary; the root page response is `200 OK` HTML containing the disclaimer banner copy from `messages/es.json`

#### Scenario: Smoke uploads artifacts on success and failure
- **WHEN** the smoke workflow finishes for any reason
- **THEN** an `actions/upload-artifact@v4` step has uploaded a directory containing at minimum: the body of each `/api/*` response exercised, the rendered root HTML, the `healthz.json` snapshot, and the captured logs of `viewer`, `otp`, and `bridge` services

### Requirement: Viewer documentation SHALL describe stack, endpoints, and i18n flow

A `viewer/README.md` (Spanish primary) and `viewer/README.en.md` (English mirror, per project convention) SHALL document, at minimum:

- The stack (Next.js App Router + React 19 + TypeScript + `next-intl` + Zod + axios + `gtfs-realtime-bindings`) and the pinned Node major.
- How to run the viewer locally via `docker compose up viewer` (with the prereq that `.env` exists and `data/output/gtfs.zip` is built).
- How to develop with hot reload via `npm run start:dev` (Next.js dev server).
- The API surface (5 endpoints + 2 stubs + healthz) with request/response shapes.
- The static + chrome layer: layout root, disclaimer banner, `LocaleSwitcher`.
- The i18n flow with `next-intl`: how to add a new locale.
- A pointer to the spec contract at `openspec/specs/viewer-shell-and-api/spec.md`.

The root `README.md` (+ `README.en.md`) SHALL link to `viewer/README.md` from its Documentation section and SHALL display the `viewer.yml` and `viewer-smoke.yml` workflow badges. `deployment/README.md` SHALL be updated to show the viewer as the sole public-facing service.

The PRD (`docs/prd/mvp-v0.md`) SHALL be updated to reflect the architectural unification (per the "Updates al PRD" section in the proposal).

#### Scenario: viewer/README.md exists and is linked from the root README
- **WHEN** the repository is inspected
- **THEN** `viewer/README.md` and `viewer/README.en.md` are present, and the root `README.md` references `viewer/README.md` from its Documentation section

#### Scenario: PRD reflects the unified architecture
- **WHEN** `docs/prd/mvp-v0.md` is inspected after this change is applied
- **THEN** the stack table in §6.1 lists a single user-facing service (the Next.js viewer + API), §10.1 Q4 and Q5 are marked resolved, and the §11 mapping no longer lists `bff-api-and-routes` or a separate `viewer-shell-and-i18n` row

### Requirement: The viewer SHALL serve the OD mode at `/` as its default landing

The root route (`app/page.tsx`) SHALL render the OD planning experience (per [`viewer-od-mode`](../viewer-od-mode/spec.md) R-01) as the default landing in v0. The placeholder `landing.title` / `landing.subtitle` content shipped with the initial `viewer-shell-and-api` apply SHALL be removed from the rendered output — those keys MAY remain in the i18n catalog only if reused by the OD mode itself.

#### Scenario: Root response is the OD mode, not the placeholder
- **WHEN** a client requests `GET /` against a viewer that ships with `viewer-od-mode` applied
- **THEN** the HTML response no longer contains the v0 placeholder copy (`landing.title` / `landing.subtitle`) as the page's main content, and instead carries the OD search bar + map shell wired up
