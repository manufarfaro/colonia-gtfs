## Purpose

AVL → GTFS-Realtime bridge for the v0 stack: an internal NestJS service that polls the operator's AVL upstream, matches each marker against the static GTFS Schedule feed from [`gtfs-static-data`](../gtfs-static-data/spec.md), and exposes the two `.pb` endpoints that [`otp-routing`](../otp-routing/spec.md) R-05 declared as its updater contract. Covers the compose service definition, the read-only GTFS mount, the secret handling for the upstream URL, the poll loop with exponential backoff, the two GTFS-RT endpoints (with empty-feed fallback), the synthetic marker→trip matcher, the rich healthz, the CI smoke against MobilityData's `gtfs-realtime-validator`, and the end-to-end documentation.

## Requirements

### Requirement: The repository SHALL declare a `bridge` service in `docker-compose.yml`

The repo SHALL extend the existing `docker-compose.yml` at the repository root with a service named `bridge`, built from a `Dockerfile` under `./bridge/`. The service SHALL listen on container port `3001` and SHALL NOT publish that port to the host. OTP SHALL reach it via `http://bridge:3001` on the internal Docker network (the URL contract pinned by [`otp-routing`](../otp-routing/spec.md) R-05).

The service definition SHALL include `restart: unless-stopped`, the env file `.env`, and a healthcheck (see the healthz requirement). It SHALL NOT publish `ports:` in the base file — `compose.override.yml`/`compose.override.ci.yml` MAY publish 3001 for local debug or CI.

#### Scenario: Compose file declares a bridge service
- **WHEN** the repository is inspected and `docker-compose.yml` is read
- **THEN** it declares a service named `bridge` whose `build` references `./bridge/` (or `./bridge` with a default Dockerfile)

#### Scenario: Bridge is not exposed on the host by default
- **WHEN** the `bridge` service in the base `docker-compose.yml` is inspected
- **THEN** it has no `ports:` mapping; OTP reaches it as `http://bridge:3001` over the internal Docker network

### Requirement: The bridge SHALL mount the static GTFS feed read-only

The `bridge` service SHALL mount the host path `./data` into the container at `/var/bridge/gtfs` with the `:ro` flag, so the service can read `agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt` (the inputs consumed by [`gtfs-static-data`](../gtfs-static-data/spec.md)). The bridge SHALL NOT depend on the bundled `gtfs.zip` — it reads the `.txt` files directly so it doesn't need an unzip path at startup.

#### Scenario: Static GTFS mount is declared read-only
- **WHEN** the `bridge` service definition is inspected
- **THEN** it declares `./data:/var/bridge/gtfs:ro`

#### Scenario: Required GTFS files are reachable at the mounted path
- **WHEN** the container starts and lists `/var/bridge/gtfs/`
- **THEN** at minimum `agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt` are present

### Requirement: The AVL upstream URL SHALL be treated as a secret — never committed, never logged, sourced from environment

The bridge SHALL read the AVL upstream URL from the environment variable `ORIGIN_AVL`. No artifact in the repository (source code, tests, fixtures, docs, configs, examples, CI workflows) SHALL contain the real URL — only the literal placeholder `ORIGIN_AVL=<set-locally-or-via-ci-secret>` in `.env.example` is permitted.

Configuration loading SHALL follow these channels by environment:

| Environment | Source of `ORIGIN_AVL` |
|---|---|
| Local dev / demo host | `.env` file at the repo root (gitignored). Operator copies `.env.example` to `.env` and fills the value locally. |
| GitHub Actions CI (any workflow that needs the live URL) | A repository (or organization) secret named `ORIGIN_AVL`, exposed to the job via `env: { ORIGIN_AVL: ${{ secrets.ORIGIN_AVL }} }`. The secret value SHALL NOT be `echo`ed or embedded into logged commands. |
| Validator smoke workflow (`bridge-rt-validate.yml`) | `ORIGIN_AVL=file://<path-to-fixture>` — this workflow does NOT need the live URL because it uses a committed fixture. Therefore it SHALL NOT reference `secrets.ORIGIN_AVL`. |

The repository SHALL include `.env.example` documenting the three env vars (`ORIGIN_AVL=` with no value, `POLL_INTERVAL_MS=30000`, `BRIDGE_PORT=3001`). The real `.env` SHALL be listed in `.gitignore`.

The bridge SHALL NOT log the value of `ORIGIN_AVL`, neither in steady-state logs nor in error messages. Outgoing HTTP errors (`AxiosError` instances, whose default payload includes `config.url`; parse errors; timeouts) SHALL be sanitized — converted to domain errors whose message does not include the URL — before they reach any log appender. Healthz output (R-07) SHALL NOT include the URL either.

#### Scenario: .env.example exists, real .env is gitignored, neither contains the real URL
- **WHEN** the repository is inspected
- **THEN** `.env.example` is present at the repo root with `ORIGIN_AVL=` (no value), `POLL_INTERVAL_MS`, and `BRIDGE_PORT` placeholders; `.gitignore` contains `.env`; no other tracked file contains the real upstream URL

#### Scenario: AVL URL is not echoed in logs or health responses
- **WHEN** the bridge logs at any level (info, warn, error) about a poll outcome, or responds to `GET /healthz`
- **THEN** the URL of the AVL upstream does not appear in the output

#### Scenario: CI workflows pull the URL from secrets (when they need it at all)
- **WHEN** a workflow needs to poll the live AVL upstream (i.e. not the fixture path)
- **THEN** it reads `ORIGIN_AVL` from `${{ secrets.ORIGIN_AVL }}` and exposes it via the step's `env:` block — never via `run: echo`, `run: export`, or inline command substitution that could surface it in CI logs

### Requirement: The bridge SHALL poll the AVL upstream every 30 seconds with exponential backoff on error

The bridge SHALL run a scheduled poll loop at a base interval defined by `POLL_INTERVAL_MS` (default 30 000 ms). Each poll SHALL fetch the URL in `ORIGIN_AVL` over HTTP with a 10 s timeout, decode the response body as ISO-8859-1, parse it as XML, and produce an in-memory snapshot of markers.

On a poll error (non-2xx HTTP status, timeout, parse failure, empty body), the bridge SHALL apply exponential backoff: the next attempt waits `30s → 60s → 120s → 240s → 300s` (cap at 300 s) before retrying. The backoff SHALL reset to the base interval on the first successful poll.

#### Scenario: Healthy poll cadence
- **WHEN** the upstream is reachable and returns valid XML
- **THEN** the bridge polls every `POLL_INTERVAL_MS` milliseconds, with each successful poll resetting any prior backoff

#### Scenario: Exponential backoff under sustained errors
- **WHEN** the upstream returns errors for three consecutive polls
- **THEN** the gap between attempts grows along the sequence `60s, 120s, 240s` (capped at 300 s thereafter) and resets to 30 s when the next poll succeeds

### Requirement: The bridge SHALL expose two GTFS-Realtime endpoints satisfying the `otp-routing` URL contract

The bridge SHALL serve, on `http://bridge:3001`, the two endpoints declared in [`otp-routing`](../otp-routing/spec.md) R-05:

| Path | Content-Type | Payload |
|---|---|---|
| `GET /gtfs-rt/vehicle-positions.pb` | `application/x-protobuf` | A GTFS-Realtime `FeedMessage` whose entities are `VehiclePosition`s for each marker matched to a trip |
| `GET /gtfs-rt/trip-updates.pb` | `application/x-protobuf` | A GTFS-Realtime `FeedMessage` whose entities are `TripUpdate`s with `stop_time_update` deltas (delay in seconds) for the next 5 stops of each matched trip |

Both responses SHALL include a valid header with `gtfs_realtime_version: "2.0"`, `incrementality: FULL_DATASET`, and `timestamp` set to the latest successful poll's timestamp. Both `FeedMessage`s SHALL be encoded via the official `gtfs-realtime-bindings` library (no hand-rolled protobuf).

The `feedId` of every `FeedEntity.id` and of every `TripDescriptor.trip_id` reference SHALL be consistent with `agency_id = sol-antigua` in `data/agency.txt`.

#### Scenario: Vehicle positions response is valid GTFS-RT FeedMessage with header
- **WHEN** OTP polls `GET /gtfs-rt/vehicle-positions.pb`
- **THEN** the response is `200 OK`, `Content-Type: application/x-protobuf`, the body decodes via `gtfs-realtime-bindings` to a `FeedMessage` whose `header.gtfs_realtime_version` is `"2.0"` and `header.incrementality` is `FULL_DATASET`

#### Scenario: Trip updates carry stop_time_update deltas
- **WHEN** OTP polls `GET /gtfs-rt/trip-updates.pb` while at least one marker is matched to a trip
- **THEN** the response contains at least one `FeedEntity` whose `trip_update.stop_time_update[]` array is non-empty, with each entry exposing a delay in seconds

#### Scenario: Empty fallback when the last poll is stale
- **WHEN** more than 120 s have elapsed since the last successful poll
- **THEN** both endpoints SHALL still return `200 OK` with a valid `FeedMessage` whose `entity` array is empty and whose `header.timestamp` reflects the current request time

### Requirement: The bridge SHALL match AVL markers to GTFS trips via synthetic matching, with a deterministic fallback

For each marker in the latest snapshot, the bridge SHALL derive a `trip_id` by the following algorithm:

1. If the marker's operator-side service identifier (`srv`) exactly matches a `trip_id` in `data/trips.txt`, use it (forward-compatible fast path).
2. Otherwise, determine the active `service_id` for the current date in `America/Montevideo` from `calendar.txt` + `calendar_dates.txt`.
3. Filter candidate trips by (route_short_name == marker.lin, direction_id == marker.dir, service_id).
4. For each candidate, compute the great-circle distance between `(marker.lat, marker.lon)` and the position interpolated from that trip's `stop_times.txt` at `marker.time`.
5. Pick the trip with the smallest distance, provided that distance is ≤ a configurable maximum (default 200 m).
6. If no candidate falls within the threshold, the marker SHALL be **dropped** from the emitted `FeedMessage` and SHALL increment the `unmatched` counter exposed via healthz.

Dropped markers SHALL NOT cause the endpoints to fail; they SHALL be logged at `info` level (one log entry per unmatched marker per poll).

#### Scenario: Marker matches via geometric snap
- **WHEN** a marker carries `lin = 4`, `dir = 1`, `lat/lon` near the trajectory of trip `4-weekday-1-2300`
- **THEN** the emitted `FeedMessage` includes that marker mapped to `trip_id = 4-weekday-1-2300`

#### Scenario: Unmatched marker is dropped, not crashed
- **WHEN** a marker carries `lin = 4` but its position is more than 200 m from any candidate trip's interpolated trajectory
- **THEN** the marker is omitted from the emitted `FeedMessage`, `unmatched_count` increments, and the endpoint still responds `200 OK`

### Requirement: The bridge SHALL expose `GET /healthz` with a rich JSON status

`GET /healthz` SHALL respond `200 OK` with `Content-Type: application/json` and a body conforming to this shape:

```json
{
  "status": "ok" | "degraded" | "down",
  "last_poll_ts": "<ISO-8601 UTC>",
  "last_success_ts": "<ISO-8601 UTC>",
  "feed_age_seconds": <integer>,
  "miss_rate_pct": <float 0-100>,
  "vehicles_tracked": <integer>,
  "vehicles_unmatched": <integer>,
  "current_backoff_seconds": <integer>
}
```

The `status` field SHALL be determined by:

- `"ok"` when `feed_age_seconds <= 60` AND `miss_rate_pct (last 10 polls) <= 10`.
- `"degraded"` when `feed_age_seconds` is in `(60, 120]` OR `miss_rate_pct` is in `(10, 50]`.
- `"down"` when `feed_age_seconds > 120` OR `miss_rate_pct > 50`.

The compose `healthcheck:` SHALL probe this endpoint and treat both `"ok"` and `"degraded"` as healthy from Docker's perspective (the container is alive and responding). `"down"` SHALL still cause the endpoint to respond — it MUST NOT cause the process to exit.

#### Scenario: Healthz reports ok on a fresh successful poll
- **WHEN** the last poll succeeded less than 60 s ago and the recent miss rate is 0
- **THEN** `GET /healthz` returns 200 with `{"status": "ok", ...}` and `feed_age_seconds <= 60`

#### Scenario: Healthz reports degraded under partial outage
- **WHEN** 90 s have elapsed since the last success but the service still polls
- **THEN** `GET /healthz` returns 200 with `{"status": "degraded", ...}` and the bridge still serves `.pb` endpoints (with empty fallback if stale)

### Requirement: A CI workflow SHALL validate the bridge's GTFS-RT output against MobilityData's `gtfs-realtime-validator` using a committed AVL fixture

A workflow `.github/workflows/bridge-rt-validate.yml` SHALL run on push/PR that touches any of: `bridge/**`, `data/*.txt`, `docker-compose.yml`, or the workflow file itself. The job SHALL:

1. Check out the repo.
2. Install Node (major version matching `bridge/package.json` `engines.node`) and run `npm ci` + `npm run build` inside `bridge/`.
3. Start the bridge in *fixture mode* — set `ORIGIN_AVL=file://./test/fixtures/avl-sample.xml`, where `avl-sample.xml` is a committed sample of representative AVL output (ISO-8859-1). The fixture SHALL NOT include the real upstream URL or any operator-side credential — only the marker payload shape needed for the matcher and validator. This workflow SHALL NOT reference `secrets.ORIGIN_AVL`.
4. Wait for `GET /healthz` to report `"status": "ok"` or `"degraded"` (the fixture is a snapshot — `last_success_ts` is the fixture's timestamp, not "now"; "degraded" is acceptable here).
5. Download `/gtfs-rt/vehicle-positions.pb` and `/gtfs-rt/trip-updates.pb`.
6. Run MobilityData's `gtfs-realtime-validator` against the two `.pb` files plus the static `gtfs.zip` produced by `tooling/scripts/build_gtfs_zip.py`.
7. Assert zero P0 and zero P1 errors.

The workflow SHALL exit non-zero if any step fails, and SHALL upload the captured `.pb` files plus the validator report as a workflow artifact (`actions/upload-artifact@v4`, `if: always()`) so reviewers can inspect the run, matching the pattern used by `otp-smoke.yml`.

A second workflow `.github/workflows/bridge.yml` SHALL run lint + unit tests inside `bridge/` on the same triggers as the validator workflow.

#### Scenario: Validator workflow runs on bridge changes
- **WHEN** a pull request modifies `bridge/src/` or `bridge/test/fixtures/avl-sample.xml`
- **THEN** the `bridge-rt-validate` workflow is triggered for that PR

#### Scenario: Validator asserts zero P0/P1 errors
- **WHEN** the workflow runs `gtfs-realtime-validator` against the fetched `.pb` files
- **THEN** the validator report contains zero entries at severity P0 and zero at severity P1; the job exits zero

#### Scenario: Validator artifacts are uploaded
- **WHEN** the workflow finishes (success or failure)
- **THEN** an `actions/upload-artifact@v4` step has uploaded a directory containing at minimum the two `.pb` responses and the validator's report

### Requirement: Bridge documentation SHALL describe the service end-to-end

A `bridge/README.md` (Spanish primary) and `bridge/README.en.md` (English mirror, per project convention) SHALL document, at minimum:

- The stack (NestJS + `@nestjs/axios` + `fast-xml-parser` + `iconv-lite` + `gtfs-realtime-bindings`) and the pinned Node major version.
- How to run the bridge locally via `docker compose up bridge` (with the prereq that `.env` exists).
- The two `.pb` endpoints, the healthz contract, and how to refresh the static GTFS (restart the container).
- The expected behavior when the AVL upstream is unreachable (backoff + empty-feed fallback + `"degraded"`/`"down"` healthz).
- A pointer to the spec contract at `openspec/specs/bridge-gtfs-rt/spec.md`.

The root `README.md` (+ `README.en.md`) SHALL link to `bridge/README.md` from its Documentation section and SHALL display the `bridge.yml` and `bridge-rt-validate.yml` workflow badges. `deployment/README.md` SHALL be updated so its "Bridge ausente — comportamiento esperado" section also documents the "bridge presente" path.

#### Scenario: bridge/README.md exists and is linked from the root README
- **WHEN** the repository is inspected
- **THEN** `bridge/README.md` and `bridge/README.en.md` are present, and the root `README.md` references `bridge/README.md` from its Documentation section

#### Scenario: Workflow badges are visible in the root README
- **WHEN** the root `README.md` is rendered
- **THEN** it includes status badges for both `bridge.yml` and `bridge-rt-validate.yml`
