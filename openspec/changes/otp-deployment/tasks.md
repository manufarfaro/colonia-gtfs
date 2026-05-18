## 1. Compose scaffolding

- [ ] 1.1 Create `docker-compose.yml` at the repository root (none exists yet)
- [ ] 1.2 Declare the `otp` service block: `image`, `command`, mounts, env, healthcheck, no published `ports`
- [ ] 1.3 Use the pinned image tag `opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42` (or the current latest pin chosen at apply time, recorded in the commit message)
- [ ] 1.4 Add a `compose.override.yml.example` showing how to expose `8080` to the host for local debugging, without committing the override itself

## 2. OTP configuration files

- [ ] 2.1 Create `deployment/otp/router-config.json` with the two GTFS-RT updaters per spec R-05 (vehicle-positions @ 15s, stop-time-updater @ 30s, both pointing at `http://bridge:3001/...`, `feedId: sol-antigua`)
- [ ] 2.2 If OTP 2.10 requires it, create `deployment/otp/build-config.json` with sensible defaults (osm pbf reference, transit graph config). Otherwise rely on OTP defaults
- [ ] 2.3 Mount `data/output/gtfs.zip`, `data/colonia.osm.pbf`, and `deployment/otp/router-config.json` (all `:ro`) into the container at `/var/opentripplanner/`
- [ ] 2.4 Set `JAVA_TOOL_OPTIONS=-Xmx1g -Xms512m` on the service

## 3. Healthcheck

- [ ] 3.1 Add a compose `healthcheck:` block invoking `curl -fsS http://localhost:8080/otp/actuators/health`, with `start_period: 60s` and reasonable `interval`/`retries`
- [ ] 3.2 Verify the actuators endpoint is enabled in `router-config.json` (or the OTP defaults — OTP 2.10 enables it by default per upstream docs; confirm)

## 4. CI smoke test workflow

- [ ] 4.1 Create `.github/workflows/otp-smoke.yml` with triggers on push/PR for `deployment/otp/**`, `docker-compose.yml`, `data/*.txt`, `data/colonia.osm.pbf`, `tooling/scripts/build_gtfs_zip.py`, `.github/workflows/otp-smoke.yml`
- [ ] 4.2 Step: checkout
- [ ] 4.3 Step: install uv via `astral-sh/setup-uv@v3`; `uv sync --frozen --directory tooling`
- [ ] 4.4 Step: `uv run --directory tooling python scripts/build_gtfs_zip.py`
- [ ] 4.5 Step: `docker compose up -d otp` (with a `compose.override.ci.yml` exposing 8080 to the runner if needed)
- [ ] 4.6 Step: wait for `/otp/actuators/health` with a loop (timeout 90s, sleep 2s)
- [ ] 4.7 Step: `curl -fsS "http://localhost:8080/otp/routers/default/plan?fromPlace=-34.471,-57.852&toPlace=-34.449,-57.815&mode=TRANSIT,WALK"` and assert the response JSON has `plan.itineraries[0]` (via `jq`)
- [ ] 4.8 Step (always): `docker compose down`
- [ ] 4.9 Add a Tooling-style status badge for `otp-smoke.yml` to the root README and to `deployment/README.md`

## 5. Documentation

- [ ] 5.1 Create `deployment/README.md` with: pre-req (uv sync + build gtfs.zip), `docker compose up otp` command, expected boot time, port info, JVM heap override, behavior when bridge is absent, link to `openspec/specs/otp-routing/spec.md`
- [ ] 5.2 Update root `README.md` (and `README.en.md` mirror) to reference `deployment/README.md` from the Documentation section
- [ ] 5.3 Update `tooling/README.md` to mention that `build_gtfs_zip.py` is the dependency of `docker compose up otp`

## 6. Verification

- [ ] 6.1 Run `docker compose up otp` locally; confirm the graph builds and `/otp/actuators/health` returns 200 within 60s
- [ ] 6.2 Issue a plan query for `Buquebus → Plaza de Toros` (the PRD canonical use case) and confirm the response includes the expected walking leg at the end (since L3 doesn't reach PdT directly per the data — see PR #7 context)
- [ ] 6.3 Confirm OTP starts and serves queries even with no bridge running; logs show updater-connection errors but the service stays healthy
- [ ] 6.4 Run `openspec validate --all --strict --no-interactive` and confirm green
