## Purpose

Trip-planning engine for the v0 stack: OpenTripPlanner 2 deployed as a Docker Compose service that consumes the [`gtfs-static-data`](../gtfs-static-data/spec.md) outputs (`data/output/gtfs.zip` + `data/colonia.osm.pbf`) and exposes a routing API on the internal Docker network for the downstream specs (`bridge-gtfs-rt`, `bff-api-and-routes`, `viewer-od-mode`). Covers the compose service definition, the OTP config files, the read-only mounts, the JVM heap budget, the GTFS-RT updater contract that the bridge SHALL honor, the healthcheck, and the CI smoke workflow that exercises the end-to-end boot path.

## Requirements

### Requirement: The repository SHALL declare an OpenTripPlanner 2 service in `docker-compose.yml`

The repo SHALL include a `docker-compose.yml` at the repository root that declares a service named `otp`, using the upstream image `opentripplanner/opentripplanner` pinned to a specific tag (no `:latest`). The image tag SHALL be `2.10.0_2026-05-13T17-42` (or a later pinned tag bumped via PR + smoke test).

The service SHALL listen on the container port `8080` and SHALL NOT expose that port to the host by default. Other services on the same Docker network reach it via `http://otp:8080`.

#### Scenario: Compose file declares an otp service with a pinned image
- **WHEN** the repository is inspected and `docker-compose.yml` is read
- **THEN** it declares a service named `otp` whose `image` is `opentripplanner/opentripplanner:<tag>` with an explicit tag (not `latest`)

#### Scenario: OTP is not exposed on the host by default
- **WHEN** the `otp` service in the base `docker-compose.yml` is inspected
- **THEN** it has no `ports:` mapping (consumers on the host can still use `docker compose port otp 8080` or a `compose.override.yml` for debug)

### Requirement: OTP SHALL mount the GTFS feed, OSM extract, and config files read-only

The `otp` service SHALL mount the following files into the container, all read-only (`:ro`), at the paths shown:

| Host path | Container path |
|---|---|
| `./data/output/gtfs.zip` | `/var/opentripplanner/gtfs.zip` |
| `./data/colonia.osm.pbf` | `/var/opentripplanner/colonia.osm.pbf` |
| `./deployment/otp/otp-config.json` | `/var/opentripplanner/otp-config.json` |
| `./deployment/otp/router-config.json` | `/var/opentripplanner/router-config.json` |

The `gtfs.zip` mount references the output of `tooling/scripts/build_gtfs_zip.py` (capability `gtfs-static-data`). The build script SHALL be invoked before `docker compose up otp` so that the file exists.

`otp-config.json` SHALL enable the `ActuatorAPI` feature (off by default in OTP 2.10), which gates the `/otp/actuators/health` endpoint required by the healthcheck requirement.

#### Scenario: Required mounts are present
- **WHEN** the `otp` service definition is inspected
- **THEN** the four mounts above are declared, each with the `:ro` flag

#### Scenario: ActuatorAPI feature is enabled
- **WHEN** `deployment/otp/otp-config.json` is parsed
- **THEN** it sets `otpFeatures.ActuatorAPI = true`

#### Scenario: Build precondition is documented
- **WHEN** `deployment/README.md` is inspected
- **THEN** it documents that `uv run --directory tooling python scripts/build_gtfs_zip.py` must be run before `docker compose up otp`

### Requirement: OTP SHALL build its graph at container start

The service command SHALL include `--build --serve` (or the equivalent for the pinned OTP version) so OTP constructs the routing graph from the mounted inputs at startup and then serves HTTP queries. The graph SHALL NOT be persisted to a Docker volume in v0; each restart rebuilds it.

#### Scenario: Container command builds and serves
- **WHEN** the `otp` service command is inspected
- **THEN** it includes `--build` and `--serve` flags (the upstream `/docker-entrypoint.sh` injects `/var/opentripplanner/` as the base path automatically)

#### Scenario: No graph persistence volume
- **WHEN** the `otp` service is inspected
- **THEN** it does not declare a named volume for the graph data (only the read-only mounts of `gtfs.zip`, `colonia.osm.pbf`, `otp-config.json`, `router-config.json`)

### Requirement: OTP SHALL run with a pinned JVM heap budget

The service SHALL set `JAVA_TOOL_OPTIONS` (or the OTP-specific env var if the image documents one) to apply `-Xmx1g -Xms512m`. These values cap the JVM at 1 GB heap and start with a 512 MB allocation.

#### Scenario: JVM heap flags are declared
- **WHEN** the `otp` service environment is inspected
- **THEN** an env var sets `-Xmx1g` and `-Xms512m`

### Requirement: `router-config.json` SHALL declare two GTFS-RT updaters pointing at the bridge

`deployment/otp/router-config.json` SHALL contain an `updaters` array with exactly two entries that poll the sibling `bridge` service for realtime data:

1. A `vehicle-positions` updater with `feedId: "sol-antigua"`, `url: "http://bridge:3001/gtfs-rt/vehicle-positions.pb"`, `frequency: "15s"`, `fuzzyTripMatching: true`.
2. A `stop-time-updater` (TripUpdates) with `feedId: "sol-antigua"`, `url: "http://bridge:3001/gtfs-rt/trip-updates.pb"`, `frequency: "30s"`.

The bridge service SHALL be defined by a subsequent change (`bridge-gtfs-rt`). Until then, OTP will log connection errors at the configured frequency and continue serving the static feed without realtime augmentation — that behavior is acceptable for v0 demo.

#### Scenario: Two updaters are declared
- **WHEN** `deployment/otp/router-config.json` is parsed
- **THEN** the `updaters` array has exactly two entries with `type` values `vehicle-positions` and `stop-time-updater`

#### Scenario: Updater URLs target the bridge contract
- **WHEN** the updaters are inspected
- **THEN** their `url` fields are `http://bridge:3001/gtfs-rt/vehicle-positions.pb` and `http://bridge:3001/gtfs-rt/trip-updates.pb` respectively

#### Scenario: Updaters tolerate a missing bridge at startup
- **WHEN** `docker compose up otp` is run without the bridge service running
- **THEN** OTP starts successfully, logs the failed updater attempts, and responds to routing queries using the static feed

### Requirement: OTP SHALL expose a healthcheck endpoint and the compose service SHALL declare a healthcheck

The OTP container SHALL expose `GET /otp/actuators/health` returning `200 OK` once the graph is built and the HTTP server is ready. The compose `otp` service SHALL declare a `healthcheck:` block that probes this endpoint and waits up to 60 seconds at startup.

The probe SHALL only depend on binaries that ship with the upstream OTP image (`bash` with `/dev/tcp` is sufficient; `curl`/`wget` are NOT present in `opentripplanner/opentripplanner:2.10.*`).

#### Scenario: Health endpoint returns 200 when ready
- **WHEN** the container has finished building the graph and is serving
- **THEN** `GET http://otp:8080/otp/actuators/health` from within the Docker network returns `200`

#### Scenario: Compose healthcheck is declared
- **WHEN** the `otp` service is inspected
- **THEN** it declares a `healthcheck:` whose `test` probes `GET /otp/actuators/health` on `http://localhost:8080` and treats `200` as healthy, with `start_period: 60s` and a reasonable interval/retries

### Requirement: A CI workflow SHALL smoke-test OTP on changes to its inputs

A workflow `.github/workflows/otp-smoke.yml` SHALL run on push/PR that touches any of: `deployment/otp/**`, `docker-compose.yml`, `compose.override.ci.yml`, `data/*.txt`, `data/colonia.osm.pbf`, `tooling/scripts/build_gtfs_zip.py`, `tooling/pyproject.toml`, `tooling/uv.lock`, or the workflow file itself. The job SHALL:

1. Check out the repo.
2. Build `gtfs.zip` via `uv run --directory tooling python scripts/build_gtfs_zip.py`.
3. Bring up the `otp` service with `docker compose up -d otp` (using `compose.override.ci.yml` to publish port 8080 to the runner).
4. Poll `http://localhost:8080/otp/actuators/health` until `200 OK` or 90s timeout.
5. Issue a single trip-plan query via the OTP 2.10 GraphQL endpoint (`POST /otp/gtfs/v1`) with two Colonia urban coordinates **pinned to a known weekday-service date and service-hour time** (so the smoke result is independent of when the runner happens to fire) and assert the response contains at least one itinerary.
6. Upload the request, response, response headers, status, summary, and the `docker compose logs otp` output as a workflow artifact (`actions/upload-artifact@v4`, `if: always()`, ~14-day retention) so reviewers can inspect the actual OTP behavior from a CI run.
7. Tear the service down.

The workflow SHALL exit non-zero if any of those steps fail.

> **Note on the routing API path:** OTP 2.10 removes the legacy REST `/otp/routers/default/plan` endpoint and only exposes routing via GraphQL at `POST /otp/gtfs/v1`. The CI workflow and the BFF (spec `bff-api-and-routes`) consume this GraphQL endpoint.

> **Note on the pinned date/time:** without a pin the GraphQL `plan` query defaults to the runner's current time, which makes the smoke flaky after service hours (Sol Antigua urbano stops by ~23:18 weekdays per `data/stop_times.txt`). The pinned date+time SHALL fall inside `feed_info.feed_start_date` / `feed_end_date` and on a day that `data/calendar.txt` marks as in-service.

#### Scenario: Workflow runs on input changes
- **WHEN** a pull request modifies `deployment/otp/router-config.json`
- **THEN** the `otp-smoke` workflow is triggered for that PR

#### Scenario: Workflow asserts at least one itinerary
- **WHEN** the smoke step issues a GraphQL `plan` query at `POST /otp/gtfs/v1` from `(-34.471, -57.852)` to `(-34.449, -57.815)` with a `date`+`time` pinned to a weekday inside the feed validity window during service hours, and `transportModes: [{mode: TRANSIT},{mode: WALK}]`
- **THEN** the response is `200 OK`, `data.plan.itineraries` is non-empty, and `data.plan.itineraries[0].legs[0]` exists

#### Scenario: Workflow uploads the smoke results as an artifact
- **WHEN** the smoke job finishes (success or failure)
- **THEN** an `actions/upload-artifact@v4` step has uploaded a directory containing at minimum: the request body sent to OTP, the HTTP status code, the response headers, the response body JSON, a human-readable summary of the returned itinerary, and the captured `docker compose logs otp` output

### Requirement: Deployment documentation SHALL describe the OTP service end-to-end

A `deployment/README.md` SHALL document, at minimum:

- How to build `gtfs.zip` before bringing up OTP.
- The `docker compose up otp` command and the typical 5–15 second graph-build time.
- The container port (`8080`), the lack of host port mapping, and how to enable a debug port via `compose.override.yml`.
- The JVM heap configuration and how to override it if needed.
- The expected behavior when the bridge is not yet running (updater errors are logged; OTP still serves the static feed).
- Where the spec contract lives (link to `openspec/specs/otp-routing/spec.md`).

#### Scenario: deployment/README.md exists and is linked from the root README
- **WHEN** the repository is inspected
- **THEN** `deployment/README.md` is present, and the root `README.md` references it from its Documentation / Stack section
