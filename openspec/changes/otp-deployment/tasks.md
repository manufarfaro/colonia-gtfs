## 1. Compose scaffolding

- [x] 1.1 Create `docker-compose.yml` at the repository root (none exists yet)
- [x] 1.2 Declare the `otp` service block: `image`, `command`, mounts, env, healthcheck, no published `ports`
- [x] 1.3 Use the pinned image tag `opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42` (or the current latest pin chosen at apply time, recorded in the commit message)
- [x] 1.4 Add a `compose.override.yml.example` showing how to expose `8080` to the host for local debugging, without committing the override itself

## 2. OTP configuration files

- [x] 2.1 Create `deployment/otp/router-config.json` with the two GTFS-RT updaters per spec R-05 (vehicle-positions @ 15s, stop-time-updater @ 30s, both pointing at `http://bridge:3001/...`, `feedId: sol-antigua`)
- [x] 2.2 If OTP 2.10 requires it, create `deployment/otp/build-config.json` with sensible defaults (osm pbf reference, transit graph config). Otherwise rely on OTP defaults — *defaults used; OTP auto-detects `gtfs.zip` y `*.osm.pbf` en `/var/opentripplanner/`. Documentado en `deployment/README.md`. Sí hubo que sumar `otp-config.json` (ver 3.2).*
- [x] 2.3 Mount `data/output/gtfs.zip`, `data/colonia.osm.pbf`, and `deployment/otp/router-config.json` (all `:ro`) into the container at `/var/opentripplanner/` — *también `otp-config.json` (ver R-02 ampliado)*
- [x] 2.4 Set `JAVA_TOOL_OPTIONS=-Xmx1g -Xms512m` on the service

## 3. Healthcheck

- [x] 3.1 Add a compose `healthcheck:` block invoking `curl -fsS http://localhost:8080/otp/actuators/health`, with `start_period: 60s` and reasonable `interval`/`retries`
- [x] 3.2 Verify the actuators endpoint is enabled in `router-config.json` (or the OTP defaults — OTP 2.10 enables it by default per upstream docs; confirm) — *La imagen `2.10.0_2026-05-13T17-42` reporta `Features turned off: ActuatorAPI`. Hubo que crear `deployment/otp/otp-config.json` con `{"otpFeatures": {"ActuatorAPI": true}}` y mountarlo. Documentado en `deployment/README.md`; spec actualizado (R-02).*

## 4. CI smoke test workflow

- [x] 4.1 Create `.github/workflows/otp-smoke.yml` with triggers on push/PR for `deployment/otp/**`, `docker-compose.yml`, `data/*.txt`, `data/colonia.osm.pbf`, `tooling/scripts/build_gtfs_zip.py`, `.github/workflows/otp-smoke.yml`
- [x] 4.2 Step: checkout
- [x] 4.3 Step: install uv via `astral-sh/setup-uv@v3`; `uv sync --frozen --directory tooling`
- [x] 4.4 Step: `uv run --directory tooling python scripts/build_gtfs_zip.py`
- [x] 4.5 Step: `docker compose up -d otp` (with a `compose.override.ci.yml` exposing 8080 to the runner if needed)
- [x] 4.6 Step: wait for `/otp/actuators/health` with a loop (timeout 90s, sleep 2s)
- [x] 4.7 Step: `curl -fsS "http://localhost:8080/otp/routers/default/plan?fromPlace=-34.471,-57.852&toPlace=-34.449,-57.815&mode=TRANSIT,WALK"` and assert the response JSON has `plan.itineraries[0]` (via `jq`) — *OTP 2.10 removió la REST de plan; ahora es `POST /otp/gtfs/v1` con un GraphQL `plan` query. Spec actualizado (R-07); workflow refactor en consecuencia.*
- [x] 4.8 Step (always): `docker compose down`
- [x] 4.9 Add a Tooling-style status badge for `otp-smoke.yml` to the root README and to `deployment/README.md`

## 5. Documentation

- [x] 5.1 Create `deployment/README.md` with: pre-req (uv sync + build gtfs.zip), `docker compose up otp` command, expected boot time, port info, JVM heap override, behavior when bridge is absent, link to `openspec/specs/otp-routing/spec.md`
- [x] 5.2 Update root `README.md` (and `README.en.md` mirror) to reference `deployment/README.md` from the Documentation section
- [x] 5.3 Update `tooling/README.md` to mention that `build_gtfs_zip.py` is the dependency of `docker compose up otp`

## 6. Verification

- [x] 6.1 Run `docker compose up otp` locally; confirm the graph builds and `/otp/actuators/health` returns 200 within 60s — *graph build ~2s; healthz `200 {"status":"UP"}` within ~2s of port open on the second start (with otp-config + correct compose command).*
- [x] 6.2 Issue a plan query for `Buquebus → Plaza de Toros` (the PRD canonical use case) and confirm the response includes the expected walking leg at the end (since L3 doesn't reach PdT directly per the data — see PR #7 context) — *Resultado: itinerary `WALK 233s → BUS L4 ITUZAINGO→AV JOSE P VARELA 404s → WALK 1574s/2098m a destino`. Walking leg final confirmado.*
- [x] 6.3 Confirm OTP starts and serves queries even with no bridge running; logs show updater-connection errors but the service stays healthy — *Logs show `Error reading vehicle positions from http://bridge:3001/...` y `Failed to process GTFS-RT TripUpdates feed`. `docker compose ps` reporta `Up X (healthy)`. Plan queries siguen funcionando sobre el feed estático.*
- [x] 6.4 Run `openspec validate --all --strict --no-interactive` and confirm green
