## ADDED Requirements

### Requirement: The repository SHALL declare a `bff` service in `docker-compose.yml` as the single public entry point

The repo SHALL extend the root `docker-compose.yml` with a service named `bff`, built from a `Dockerfile` under `./bff/`. The service SHALL be the **only** service in the v0 stack with a host port mapping by default (`ports: "${BFF_PORT:-8080}:8080"`). All other services (`otp`, `bridge`) SHALL keep their internal-only access per their respective specs.

The service definition SHALL include `restart: unless-stopped`, the env file `.env`, a `healthcheck` block (see the healthz requirement), and `depends_on` with `condition: service_healthy` for both `otp` and `bridge` — so `docker compose up bff` brings the full stack up in the correct order.

#### Scenario: Compose declares the bff service with the public port mapping
- **WHEN** the repository is inspected and `docker-compose.yml` is read
- **THEN** the `bff` service declares `ports:` mapping host port to container port `8080`, references `./bff` as its build context, and lists `otp` and `bridge` in `depends_on`

#### Scenario: BFF is the only public-facing service
- **WHEN** the base `docker-compose.yml` is inspected
- **THEN** neither `otp` nor `bridge` declares `ports:` mapping to the host; only `bff` does

### Requirement: The BFF SHALL serve the viewer build statically from a configurable path

The BFF SHALL mount an `express.static` middleware at the root path (`/`) that serves files from the directory pointed to by the environment variable `VIEWER_BUILD_DIR` (default `/var/bff/viewer-dist`). If the directory does not exist or is empty, the static middleware SHALL be skipped (the BFF starts and its `/api/*` routes still respond); the healthz endpoint SHALL surface that condition via a `viewer_dist_available: false` flag.

The static middleware SHALL set sensible cache headers: long max-age for fingerprinted assets (any path matching `*.{js,css,woff2,png,jpg,svg}` with a hash-like substring in the filename), `no-cache` for `index.html`.

#### Scenario: BFF serves the viewer when the build dir is present
- **WHEN** `VIEWER_BUILD_DIR` points to a directory containing at least `index.html`
- **THEN** `GET /` returns `200 OK` with that `index.html` body and a `no-cache` cache header

#### Scenario: BFF stays up when the build dir is absent
- **WHEN** `VIEWER_BUILD_DIR` does not exist at boot time
- **THEN** the BFF starts successfully, `GET /` returns `404`, and `GET /api/healthz` includes `viewer_dist_available: false`

### Requirement: `POST /api/plan` SHALL translate viewer plan requests into OTP GraphQL `plan` queries

The BFF SHALL expose `POST /api/plan` accepting a JSON body conforming to:

```json
{
  "from": { "lat": <number>, "lon": <number> },
  "to":   { "lat": <number>, "lon": <number> },
  "date": "<YYYY-MM-DD>",
  "time": "<HH:MM>"
}
```

The body SHALL be validated with a Zod-compatible schema (or equivalent). Invalid bodies SHALL get `400 Bad Request` with `{ "error": "invalid_request", "details": <validation issues> }`.

For valid bodies, the BFF SHALL `POST` an OTP GraphQL `plan` query to `${OTP_BASE_URL}/otp/gtfs/v1` with the inputs as variables. The OTP response SHALL be translated to:

```json
{
  "itineraries": [
    {
      "durationSeconds": <int>,
      "walkDistanceMeters": <number>,
      "legs": [
        {
          "mode": "WALK" | "BUS",
          "durationSeconds": <int>,
          "distanceMeters": <number>,
          "startTime": "<ISO-8601>",
          "endTime": "<ISO-8601>",
          "realtimeState": "SCHEDULED" | "UPDATED" | null,
          "route": { "shortName": <string>, "longName": <string> } | null,
          "from": { "name": <string>, "lat": <number>, "lon": <number>, "stopId": <string> | null },
          "to":   { "name": <string>, "lat": <number>, "lon": <number>, "stopId": <string> | null }
        }
      ]
    }
  ],
  "meta": { "queriedAt": "<ISO-8601>", "otpLatencyMs": <int> }
}
```

When OTP is unreachable or times out, the BFF SHALL respond `502 Bad Gateway` with `{ "error": "otp_unavailable" }`.

#### Scenario: Valid plan request returns translated itineraries
- **WHEN** the BFF receives a `POST /api/plan` with a valid body and OTP responds with at least one itinerary
- **THEN** the response is `200 OK` with the JSON shape above; `itineraries` is non-empty; the OTP-side GraphQL query is never surfaced in the response

#### Scenario: Invalid body returns 400
- **WHEN** the body is missing `from.lat` (or any required field)
- **THEN** the response is `400` with `{ "error": "invalid_request", "details": [...] }` and no upstream call is made

#### Scenario: OTP unreachable returns 502
- **WHEN** OTP cannot be reached within the timeout
- **THEN** the response is `502 Bad Gateway` with `{ "error": "otp_unavailable" }`

### Requirement: `GET /api/stops/:stopId/arrivals` SHALL return next-bus arrivals merged from scheduled + realtime

The BFF SHALL expose `GET /api/stops/:stopId/arrivals` (with optional `?limit=<int>` query, default 10). For a known stop, the BFF SHALL `POST` an OTP GraphQL query that resolves the next N scheduled arrivals at that stop including realtime updates (`stoptimesForServiceDate` or the OTP 2.10 equivalent). The translated response SHALL be:

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

When OTP is unreachable, the BFF SHALL respond `502` (without OTP we cannot even produce the scheduled list).

#### Scenario: Arrivals include both scheduled and realtime entries
- **WHEN** OTP has at least one realtime update for the queried stop
- **THEN** at least one entry in `arrivals` has `isRealtime: true` and a non-null `delaySeconds`; `meta.realtime_available` is `true`

#### Scenario: Arrivals fall back to scheduled-only when realtime is unavailable
- **WHEN** OTP has no realtime data (bridge unreachable or empty `.pb` feed)
- **THEN** every entry has `isRealtime: false`, the response is still `200 OK`, and `meta.realtime_available` is `false`

### Requirement: `GET /api/lines/:lineId` SHALL return route, shape, stops, and today's scheduled stop times

The BFF SHALL expose `GET /api/lines/:lineId` where `lineId` is one of `3, 4, 5, 8` (Sol Antigua urban lines per `gtfs-static-data`). It SHALL `POST` an OTP GraphQL query that resolves the route, its shape (encoded polyline), the stops on each direction, and the scheduled `stop_times` for the current operator-local date. The translated response SHALL be:

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
- **THEN** the second call does not produce a new OTP query (verifiable via OTP access logs); the response body is byte-identical to the first

### Requirement: `GET /api/lines/:lineId/vehicles` SHALL decode the bridge's `.pb` and filter by line

The BFF SHALL expose `GET /api/lines/:lineId/vehicles`. The handler SHALL `GET ${BRIDGE_BASE_URL}/gtfs-rt/vehicle-positions.pb` (with a 5 s timeout, `responseType: 'arraybuffer'`), decode the body via `gtfs-realtime-bindings.transit_realtime.FeedMessage.decode`, filter the entities whose `vehicle.vehicle.label === "L" + lineId` (or whose `vehicle.trip.routeId === lineId` — the bridge's emitter sets both per its R-05), and translate to:

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

When the bridge is unreachable OR the decoded `FeedMessage.entity[]` is empty, `vehicles` SHALL be `[]` and `meta.realtime_available` SHALL be `false`. The response status SHALL be `200 OK` in both cases — the bridge being down is a degradation, not a BFF failure.

This endpoint SHALL NOT be cached.

#### Scenario: Vehicles filtered to the requested line
- **WHEN** the bridge's `.pb` contains 3 vehicles on line 4 and 2 on line 5, and `GET /api/lines/4/vehicles` is called
- **THEN** the response `vehicles` array has exactly the 3 line-4 vehicles

#### Scenario: Bridge unreachable returns empty list with realtime_available=false
- **WHEN** the bridge cannot be reached within the timeout
- **THEN** the response is `200 OK` with `vehicles: []` and `meta.realtime_available: false`

### Requirement: `/api/tickets` and `/api/pois` SHALL respond `501 Not Implemented` with a documented body

The BFF SHALL expose `GET /api/tickets` and `GET /api/pois`. Both SHALL respond `501 Not Implemented` with:

```json
{
  "error": "not_implemented",
  "message": "<endpoint> is a documented v0 stub; implementation deferred to a future spec.",
  "spec": "openspec/specs/bff-api-and-routes/spec.md"
}
```

These stubs exist so consumers (the viewer or external integrators) discover the endpoints with a self-explanatory `501` rather than a `404`. The PRD §6.1 lists both as documented v0 stubs.

#### Scenario: Tickets stub responds 501
- **WHEN** `GET /api/tickets` is called
- **THEN** the response is `501 Not Implemented` with the documented JSON body and the `spec` field pointing at this spec's canonical path

### Requirement: CORS SHALL be configurable via `BFF_CORS_ORIGINS` and disabled by default

The BFF SHALL read a comma-separated list of allowed origins from the env var `BFF_CORS_ORIGINS`. When the variable is unset or empty (default), the BFF SHALL NOT mount any CORS middleware (the assumption is same-origin: the viewer is served from the BFF itself). When the variable is set, the BFF SHALL mount `cors({ origin: <parsed list> })` so the viewer dev server (and only the listed origins) can fetch the API.

The BFF SHALL NOT allow `*` (wildcard) as an origin — that combination with credentials is unsafe, and there's no v0 use case for it. A literal `*` in `BFF_CORS_ORIGINS` SHALL cause the BFF to log a warning and skip CORS entirely.

#### Scenario: CORS off by default
- **WHEN** the BFF boots with no `BFF_CORS_ORIGINS` env var
- **THEN** responses to `/api/*` do not include `Access-Control-Allow-Origin` headers

#### Scenario: CORS allows configured origins
- **WHEN** `BFF_CORS_ORIGINS="http://localhost:5173"` is set and a preflight `OPTIONS /api/plan` arrives with `Origin: http://localhost:5173`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:5173`

### Requirement: `GET /api/healthz` SHALL aggregate the status of the BFF, OTP, and bridge

`GET /api/healthz` SHALL respond `200 OK` with `Content-Type: application/json` and a body conforming to:

```json
{
  "status": "ok" | "degraded" | "down",
  "bff": { "uptime_seconds": <int>, "node_version": "<string>", "viewer_dist_available": <boolean> },
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

The endpoint SHALL probe OTP via a lightweight call (`GET ${OTP_BASE_URL}/otp/actuators/health` with 1 s timeout) and the bridge via `GET ${BRIDGE_BASE_URL}/healthz` (1 s timeout). Probes are made **on each `/api/healthz` request** (no background polling) so the data is fresh.

#### Scenario: All green when both upstreams are healthy
- **WHEN** OTP responds `200` to its actuator health and the bridge's healthz returns `status: "ok"`
- **THEN** `GET /api/healthz` returns `200` with aggregate `status: "ok"`

#### Scenario: Degraded when only the bridge is down
- **WHEN** OTP is reachable but the bridge times out
- **THEN** `GET /api/healthz` returns `200` with aggregate `status: "degraded"`, `bridge.reachable: false`, and `bridge.downstream: null`

#### Scenario: Down when OTP is unreachable
- **WHEN** OTP times out
- **THEN** `GET /api/healthz` returns `200` with aggregate `status: "down"` and `otp.reachable: false`

### Requirement: CI workflows SHALL lint, unit-test, and smoke-test the BFF end-to-end

Two GitHub Actions workflows SHALL exist:

- `.github/workflows/bff.yml`: triggers on push/PR for `bff/**` and the workflow file. Steps: checkout, setup-node (major matching `bff/package.json` engines), `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- `.github/workflows/bff-smoke.yml`: triggers on push/PR for `bff/**`, `docker-compose.yml`, `data/*.txt`, `bridge/**`, `deployment/otp/**`, or the workflow file. Steps:
  1. Checkout.
  2. Setup Node 26 + Java 21 + uv.
  3. Build `gtfs.zip` via `tooling/scripts/build_gtfs_zip.py`.
  4. `docker compose -f docker-compose.yml -f compose.override.ci.yml up -d otp bridge bff` with `ORIGIN_AVL=file://./bridge/test/fixtures/avl-sample.xml`.
  5. Poll `GET /api/healthz` until aggregate `status` ∈ `ok | degraded` (timeout 90 s).
  6. Issue requests to `POST /api/plan` (Buquebus → PdT canonical coordinates, pinned weekday+time), `GET /api/lines/4`, `GET /api/lines/4/vehicles`. Assert response shape and status.
  7. Upload `smoke-out/` (responses, healthz body, BFF + OTP + bridge logs) as an artifact via `actions/upload-artifact@v4` with `if: always()`.

The smoke workflow SHALL NOT reference `secrets.ORIGIN_AVL` — it uses the committed fixture, per the secret-handling contract inherited from `bridge-gtfs-rt` R-03.

#### Scenario: Lint+test workflow runs on bff changes
- **WHEN** a pull request modifies any file under `bff/src/`
- **THEN** the `bff` workflow runs `npm run lint`, `npm test`, and `npm run build`, and fails the build on any failure

#### Scenario: Smoke workflow asserts the stack-wide path
- **WHEN** the smoke workflow boots the stack and calls `POST /api/plan` with the canonical Buquebus → PdT coordinates pinned to a weekday at 14:00
- **THEN** the response is `200 OK` with at least one itinerary whose first leg's `mode` is `WALK` or `BUS` and whose `route.shortName` (if present) is one of `{3, 4, 5, 8}`

#### Scenario: Smoke uploads artifacts on success and failure
- **WHEN** the smoke workflow finishes for any reason
- **THEN** an `actions/upload-artifact@v4` step has uploaded a directory containing at minimum: the body of each `/api/*` response exercised, the `healthz.json` snapshot, and the captured logs of `bff`, `otp`, and `bridge` services

### Requirement: BFF documentation SHALL describe the API surface end-to-end

A `bff/README.md` (Spanish primary) and `bff/README.en.md` (English mirror, per project convention) SHALL document, at minimum:

- The stack (Express + TypeScript + axios + zod + gtfs-realtime-bindings) and the pinned Node major.
- How to run the BFF locally via `docker compose up bff` (with the prereq that `.env` exists and `data/output/gtfs.zip` is built).
- Each REST endpoint with request shape, response shape, and degradation behavior.
- The static-serve flow (`VIEWER_BUILD_DIR`).
- The CORS configuration (`BFF_CORS_ORIGINS`).
- A pointer to the spec contract at `openspec/specs/bff-api-and-routes/spec.md`.

The root `README.md` (+ `README.en.md`) SHALL link to `bff/README.md` from its Documentation section and SHALL display the `bff.yml` and `bff-smoke.yml` workflow badges. `deployment/README.md` SHALL be updated to show the BFF as the sole public-facing service in the stack diagram.

#### Scenario: bff/README.md exists and is linked from the root README
- **WHEN** the repository is inspected
- **THEN** `bff/README.md` and `bff/README.en.md` are present, and the root `README.md` references `bff/README.md` from its Documentation section

#### Scenario: Workflow badges are visible in the root README
- **WHEN** the root `README.md` is rendered
- **THEN** it includes status badges for both `bff.yml` and `bff-smoke.yml`
