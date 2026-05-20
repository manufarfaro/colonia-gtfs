> **Implementation discipline.** This apply runs under `superpowers:test-driven-development` (`/test-driven-development`) per [D-11](design.md#d-11--implementación-test-first-tdd-vía-superpowerstest-driven-development) of the design. Every "tests for X" / "implement X" pair is ordered test-first: red (test fails with a concrete assertion error) → green (minimal implementation) → refactor. Scaffolding (group 1), compose integration (group 7), CI workflows (group 8), docs (group 9), and the trivial 501 stubs (group 6) are out of the TDD flow.

## 1. BFF scaffolding (Express + TS workspace)

- [ ] 1.1 Create `bff/` at the repo root with `package.json` (pinned versions: `express`, `cors`, `axios`, `zod`, `gtfs-realtime-bindings`)
- [ ] 1.2 Add `bff/tsconfig.json`, `bff/eslint.config.js` (flat config v10), `bff/.prettierrc`; declare `engines.node: "26.x"` in `package.json` (per design D-03)
- [ ] 1.3 Create `bff/Dockerfile` multi-stage (`node:26.1.0-alpine3.23 AS build` → runtime with only `dist/` + production `node_modules` + `bin/healthcheck.js`); record the patch tag in the apply commit message
- [ ] 1.4 Create `bff/src/main.ts` (Express bootstrap on `process.env.BFF_PORT ?? 8080`) and `bff/src/app.ts` (factory that builds the app — testable without listening on the port)
- [ ] 1.5 Update `.env.example` with `BFF_PORT=8080`, `OTP_BASE_URL=http://otp:8080`, `BRIDGE_BASE_URL=http://bridge:3001`, `BFF_CORS_ORIGINS=`, `VIEWER_BUILD_DIR=/var/bff/viewer-dist`
- [ ] 1.6 Configure scripts in `bff/package.json`: `build`, `start`, `start:dev` (via `tsx watch`), `lint`, `test`, `test:watch`
- [ ] 1.7 Create `bff/test/fixtures/otp/` with committed GraphQL responses (`plan-response.json`, `line-response.json`, `arrivals-response.json`) — deterministic input for the REST↔GraphQL translator tests
- [ ] 1.8 Create `bff/test/fixtures/bridge/vehicle-positions.pb` — sanitized binary sample of the bridge's feed for the vehicles decoder tests (opaque IDs, no real upstream URL)
- [ ] 1.9 Create `bff/bin/healthcheck.js` — node-based probe of the BFF's `/api/healthz` (alpine ships no bash/curl); exit 0 when aggregate status is `ok` or `degraded`

## 2. OTP GraphQL client + `POST /api/plan` (TDD)

- [ ] 2.1 **Red** — write tests for the OTP→REST plan translator: given the committed `plan-response.json` fixture, assert the translation to the R-03 shape is correct (`durationSeconds`, `walkDistanceMeters`, `legs[].mode`, `legs[].route.shortName`, etc.). Also assert Zod validation rejects invalid bodies with `400`
- [ ] 2.2 **Green** — implement `bff/src/otp/client.ts` (axios HTTP client + 10 s timeout + error wrap that does NOT include the OTP URL in its message), `bff/src/otp/queries.ts` (PLAN_QUERY template string), `bff/src/otp/translate-plan.ts` (response → REST shape), `bff/src/handlers/plan.ts` (zod validation + dispatch); until 2.1 passes
- [ ] 2.3 **Red** — supertest E2E test for the handler: mock the axios `post` → return the fixture response → `POST /api/plan` valid body → assert status 200 + shape; invalid body → 400; OTP down (mock rejects) → 502 with `{error:"otp_unavailable"}`
- [ ] 2.4 **Green** — wire the `POST /api/plan` handler in `bff/src/app.ts`; add the timeout/error mapping to 502 until 2.3 passes

## 3. `GET /api/stops/:stopId/arrivals` (TDD)

- [ ] 3.1 **Red** — translator tests for arrivals: given the `arrivals-response.json` fixture (with a mix of scheduled and realtime entries), assert the mapping to `arrivals[].isRealtime` + `delaySeconds` + `meta.realtime_available` is correct. "All scheduled" → `meta.realtime_available: false`. "OTP returns null for stop" → 404
- [ ] 3.2 **Green** — implement `bff/src/otp/translate-arrivals.ts`, `bff/src/handlers/arrivals.ts`, and the GraphQL query in `queries.ts`. Wire in `app.ts` until 3.1 passes
- [ ] 3.3 **Red** — supertest E2E: `GET /api/stops/<known>/arrivals?limit=5` → 200 with `arrivals.length <= 5`; `GET /api/stops/<unknown>/arrivals` → 404; OTP down → 502
- [ ] 3.4 **Green** — complete the handler wiring with limit clamp + 404 mapping for unknown stops + 502 mapping until 3.3 passes

## 4. `GET /api/lines/:lineId` + caching (TDD)

- [ ] 4.1 **Red** — translator tests for lines: `line-response.json` → mapping to `{ line, shape, directions[] }`; assert `directions` has 2 entries (0 and 1) each with non-empty `stops[]` and `scheduledDepartures[]`; assert `meta.date` is in TZ Montevideo
- [ ] 4.2 **Green** — implement `bff/src/otp/translate-line.ts`, `bff/src/handlers/line.ts`, and the GraphQL query. Wire in `app.ts` until 4.1 passes
- [ ] 4.3 **Red** — cache TTL tests: two consecutive calls to `/api/lines/4` within 60 s → the mocked `axios.post` is called once. After advancing the injected clock 61 s → second call issues a new request. Cache key includes `(lineId, date)` — day rollover invalidates
- [ ] 4.4 **Green** — implement `bff/src/util/ttl-cache.ts` (Map + expiresAt; inject the clock via an interface) and integrate it in the line handler until 4.3 passes. Do NOT cache time-sensitive endpoints (plan, arrivals, vehicles) — verify with tests that those handlers do NOT touch the cache

## 5. `GET /api/lines/:lineId/vehicles` (TDD)

- [ ] 5.1 **Red** — decoder + filter tests: given `bff/test/fixtures/bridge/vehicle-positions.pb`, assert that `GET /api/lines/4/vehicles` returns only entities with `label === "L4"` (or `trip.routeId === "4"`); assert the mapping to `{ lineId, vehicles[], meta }`; bridge unreachable → 200 with `vehicles: []` + `meta.realtime_available: false`
- [ ] 5.2 **Green** — implement `bff/src/bridge/client.ts` (axios arraybuffer GET + 5 s timeout + error sanitization), `bff/src/bridge/decode-vehicles.ts` (gtfs-realtime-bindings decode + per-line filter), `bff/src/handlers/vehicles.ts`. Wire in `app.ts` until 5.1 passes
- [ ] 5.3 **Red** — E2E test: mocked bridge returns the fixture → endpoint responds with the right shape; mocked bridge fails → endpoint still returns 200 with `vehicles: []`
- [ ] 5.4 **Green** — complete the handler wiring until 5.3 passes. Do NOT cache the response (verify via test that two consecutive calls ALWAYS hit the bridge)

## 6. Stubs + aggregated healthz

- [ ] 6.1 Add handlers for `GET /api/tickets` and `GET /api/pois` returning `501` with the documented body (per spec R-07) — ~5-line handlers each, no TDD
- [ ] 6.2 **Red** — aggregated healthz tests: mock OTP `/otp/actuators/health` + bridge `/healthz`; assert the full matrix from spec R-08 (ok/degraded/down across the combinations). Reasonable `bff.uptime_seconds`. `viewer_dist_available: false` when `VIEWER_BUILD_DIR` doesn't exist
- [ ] 6.3 **Green** — implement `bff/src/handlers/healthz.ts` with parallel probes (axios + 1 s timeouts) and the classification logic. Wire in `app.ts` until 6.2 passes

## 7. CORS + static serve + compose integration

- [ ] 7.1 **Red** — CORS middleware tests: `BFF_CORS_ORIGINS=""` → responses lack `Access-Control-Allow-Origin`. `BFF_CORS_ORIGINS="http://localhost:5173"` + `OPTIONS /api/plan` preflight with matching origin → header equals the origin. `BFF_CORS_ORIGINS="*"` → CORS not mounted + warning logged
- [ ] 7.2 **Green** — implement `bff/src/middleware/cors.ts` that parses the env and mounts `cors()` conditionally; literal `*` triggers `console.warn` and skip. Wire in `app.ts` until 7.1 passes
- [ ] 7.3 **Red** — static serve tests: with `VIEWER_BUILD_DIR=<dir-with-index.html>` → `GET /` returns the `index.html` with `Cache-Control: no-cache`. With `VIEWER_BUILD_DIR=<nonexistent>` → BFF boots fine, `GET /` returns 404, `/api/healthz` reports `viewer_dist_available: false`
- [ ] 7.4 **Green** — implement the conditional `express.static` mount with the cache-headers logic, until 7.3 passes
- [ ] 7.5 Add the `bff` service to the root `docker-compose.yml` (`build: ./bff`, `env_file .env` with `required: false`, `ports: "${BFF_PORT:-8080}:8080"`, `depends_on: { otp: { condition: service_healthy }, bridge: { condition: service_healthy } }`, `restart: unless-stopped`)
- [ ] 7.6 Add a `healthcheck:` block for `bff` that invokes `node bin/healthcheck.js` (alpine has no curl/bash; same principle as the bridge per design D-02)
- [ ] 7.7 **Remove** OTP's host port mapping from `compose.override.yml.example` — host port `8080` is now owned by the BFF; OTP stays on the internal Docker network. The CI override (`compose.override.ci.yml`) keeps its OTP mapping for `otp-smoke.yml`

## 8. CI workflows

- [ ] 8.1 Create `.github/workflows/bff.yml` — lint + unit tests + build. Triggers on push/PR to `bff/**` and the workflow file
- [ ] 8.2 Create `.github/workflows/bff-smoke.yml` — full stack in fixture mode. setup-node 26 + setup-java 21 + uv. `docker compose up -d otp bridge bff` with `ORIGIN_AVL=file://./bridge/test/fixtures/avl-sample.xml`. Poll `/api/healthz` until `ok|degraded`. Hit `/api/plan` (Buquebus → PdT pinned weekday+time per `otp-smoke.yml`), `/api/lines/4`, `/api/lines/4/vehicles`. Assert response shapes
- [ ] 8.3 Add `actions/upload-artifact@v4` step (`if: always()`) uploading `smoke-out/` with responses, `healthz.json`, `bff.log`, `otp.log`, `bridge.log`. 14d retention
- [ ] 8.4 Verify the `bff-smoke.yml` workflow does NOT reference `secrets.ORIGIN_AVL` — fixture mode only (per spec R-09's secret-handling inheritance from `bridge-gtfs-rt`)

## 9. Documentation

- [ ] 9.1 Create `bff/README.md` (Spanish primary per spec R-10): stack, boot via `docker compose up bff`, prereq of `.env` + `data/output/gtfs.zip`, endpoint table with request/response shapes, degradation behavior, link to the spec
- [ ] 9.2 Create `bff/README.en.md` mirror with the `Español` / `English` cross-link header
- [ ] 9.3 Update root `README.md` + `README.en.md`: add badges for `bff.yml` and `bff-smoke.yml`; add the `bff/` link in the Documentation section; refresh the "Stack" section to show the three services (bridge + otp + bff) — BFF is the only public-facing one
- [ ] 9.4 Update `deployment/README.md` + `.en.md`: refresh the stack diagram showing the BFF as the single entry point; rewrite the "Ports" section (only BFF exposes `:8080` to the host; OTP and bridge stay on the Docker internal network)

## 10. Verification

- [ ] 10.1 Run `npm test` inside `bff/` and confirm the whole TDD suite (groups 2-7) is green
- [ ] 10.2 Run `docker compose up bff` locally (with `.env` pointing the bridge at file:// fixture mode); confirm `GET /api/healthz` → 200 with `status: "ok"` (otp + bridge healthy) and `viewer_dist_available: false` (no viewer yet)
- [ ] 10.3 Issue real requests against the local stack:
   - `POST /api/plan` (Buquebus → PdT pinned) → 200 with itineraries
   - `GET /api/lines/4` → 200 with shape + directions
   - `GET /api/lines/4/vehicles` → 200; with the fixture loaded, expect live-position entries for L4
   - `GET /api/stops/<known-stop-id>/arrivals` → 200 with arrivals
   - `GET /api/tickets` → 501
- [ ] 10.4 Stop the bridge (`docker compose stop bridge`) and confirm `/api/lines/4/vehicles` still returns 200 with `vehicles: []` + `meta.realtime_available: false`; `/api/healthz` reports `degraded`
- [ ] 10.5 Stop OTP (`docker compose stop otp`) and confirm `/api/plan` returns 502; `/api/healthz` reports `down`
- [ ] 10.6 Run `openspec validate --all --strict --no-interactive` and confirm green
