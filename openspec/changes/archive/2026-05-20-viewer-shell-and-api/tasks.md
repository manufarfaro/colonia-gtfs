> **Implementation discipline.** This apply runs under `superpowers:test-driven-development` (`/test-driven-development`) per [D-14](design.md#d-14--tdd-vía-superpowerstest-driven-development-heredado-del-viejo-bff-design-d-11) of the design. Every "tests for X" / "implement X" pair is ordered test-first: red (test fails with a concrete assertion error) → green (minimal implementation) → refactor. Scaffolding (group 1), compose integration (group 8), CI workflows (group 9), docs + PRD updates (group 10) are out of the TDD flow.

## 1. Next.js workspace scaffolding

- [x] 1.1 Create `viewer/` at the repo root with `package.json` (pinned versions: `next` 16.x, `react` 19.x, `react-dom`, `next-intl`, `zod`, `axios`, `gtfs-realtime-bindings`, **+ shadcn/Tailwind runtime: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`**) — *Pinned: next 16.2.6, react 19.2.6, next-intl 4.12.0, zod 4.4.3, axios 1.16.1, gtfs-realtime-bindings 1.1.1, shadcn deps en exact versions.*
- [x] 1.2 Add `viewer/tsconfig.json`, `viewer/next.config.ts` (set `output: 'standalone'` for slim Docker image), `viewer/eslint.config.js` (flat config v10), `viewer/.prettierrc`; declare `engines.node: "26.x"` in `package.json`. Sumar Tailwind v4 dev deps (`tailwindcss`, `@tailwindcss/postcss`) + `postcss.config.mjs`. Inicializar shadcn (`components.json` con baseColor `neutral`, `lib/utils.ts` con el helper `cn()`) per design D-16 — *eslint.config.js finalizó como flat config minimal con `@typescript-eslint` (sin `eslint-config-next`), por incompatibilidad upstream con ESLint 10 — ver D-17.*
- [x] 1.3 Create `viewer/Dockerfile` multi-stage (`node:26.1.0-alpine3.23 AS deps → build → runtime`); the runtime copies `.next/standalone`, `.next/static`, `public/`, and `bin/healthcheck.js`. Record the patch tag in the apply commit message
- [x] 1.4 Scaffold the App Router skeleton: `viewer/app/layout.tsx` (wired to `NextIntlClientProvider`, hosting chrome), `viewer/app/page.tsx` (placeholder centered welcome), `viewer/app/globals.css` (`@import "tailwindcss"` + CSS vars del theme shadcn neutral) — *Layout sin chrome todavía (chrome se cablea en 2.5 post-TDD del grupo 2).*
- [x] 1.5 Scaffold `viewer/i18n/routing.ts` (declares `locales: ['es']`, `defaultLocale: 'es'`), `viewer/i18n/request.ts` (next-intl request config)
- [x] 1.6 Create `viewer/messages/es.json` with starter keys: `chrome.title`, `chrome.disclaimer`, `landing.title`, `landing.subtitle`
- [x] 1.7 Update `.env.example` at the repo root with `VIEWER_PORT=8080`, `OTP_BASE_URL=http://otp:8080`, `BRIDGE_BASE_URL=http://bridge:3001`, `VIEWER_CORS_ORIGINS=`
- [x] 1.8 Configure scripts in `viewer/package.json`: `build`, `start`, `start:dev` (`next dev`), `lint`, `test`, `test:watch` — *Sumé `vitest.config.ts` + `test/setup.ts` para que `npm test` corra contra happy-dom.*
- [x] 1.9 Create `viewer/test/fixtures/otp/` with committed GraphQL fixtures (`plan-response.json`, `line-response.json`, `arrivals-response.json`) and `viewer/test/fixtures/bridge/vehicle-positions.pb` — sanitized inputs for the translator/decoder tests — *Dirs creados, README documentando captura. Fixtures concretos se suman en grupos 3-6 según se necesiten.*
- [x] 1.10 Create `viewer/bin/healthcheck.js` — node-based probe of `/api/healthz`, exit 0 when aggregate status is `ok` or `degraded`

## 2. Chrome persistente + i18n (TDD on the components, scaffold on the layout)

- [x] 2.1 **Red** — `viewer/components/chrome/DisclaimerBanner.test.tsx` (vitest + @testing-library/react): renders the disclaimer text from `t("chrome.disclaimer")`; has no close button; is always visible regardless of locale
- [x] 2.2 **Green** — implement `viewer/components/chrome/DisclaimerBanner.tsx` (server component, uses `getTranslations()` from next-intl) until 2.1 passes — *Resuelto como client component (`useTranslations`) para test runner-friendly; server component requería request-scoped context.*
- [x] 2.3 **Red** — `viewer/components/chrome/Header.test.tsx`: renders the title from `t("chrome.title")`; renders a `LocaleSwitcher` slot; sticky positioning class applied
- [x] 2.4 **Green** — implement `viewer/components/chrome/Header.tsx` (server component) + `viewer/components/chrome/LocaleSwitcher.tsx` (client component, no-op rendering when `locales.length === 1`) until 2.3 passes — *Header también es client para alinearse con DisclaimerBanner.*
- [x] 2.5 Wire chrome into `viewer/app/layout.tsx` between `NextIntlClientProvider` and `{children}` — every page inherits the header + banner

## 3. OTP client + `POST /api/plan` (TDD)

- [x] 3.1 **Red** — translator tests for the plan: given the committed `plan-response.json` fixture, assert the translation to the R-04 shape is correct (`durationSeconds`, `walkDistanceMeters`, `legs[].mode`, `legs[].route.shortName`, etc.). Also assert Zod validation rejects invalid bodies with `400`. Also assert the error wrap on `AxiosError` does NOT include OTP URL in its message
- [x] 3.2 **Green** — implement `viewer/lib/otp/client.ts` (axios + 10 s timeout + error sanitization), `viewer/lib/otp/queries.ts` (PLAN_QUERY template string), `viewer/lib/otp/translate-plan.ts`, `viewer/lib/validation/plan.ts` (Zod schema); until 3.1 passes
- [x] 3.3 **Red** — route handler test for `app/api/plan/route.ts`: invoke the exported `POST` handler with mocked axios → assert status 200 + shape; invalid body → 400; OTP down (mock rejects) → 502 with `{error:"otp_unavailable"}`
- [x] 3.4 **Green** — implement `viewer/app/api/plan/route.ts` (`POST` handler) until 3.3 passes

## 4. `GET /api/stops/:stopId/arrivals` (TDD)

- [x] 4.1 **Red** — translator tests for arrivals: given the `arrivals-response.json` fixture (mix of scheduled + realtime entries), assert mapping to `arrivals[].isRealtime` + `delaySeconds` + `meta.realtime_available` is correct. "All scheduled" → `meta.realtime_available: false`. "OTP returns null for stop" → 404
- [x] 4.2 **Green** — implement `viewer/lib/otp/translate-arrivals.ts` + the GraphQL query in `queries.ts` + handler at `viewer/app/api/stops/[stopId]/arrivals/route.ts` until 4.1 passes
- [x] 4.3 **Red** — E2E test of the route handler: `GET /api/stops/<known>/arrivals?limit=5` → 200 with `arrivals.length <= 5`; unknown stop → 404; OTP down → 502
- [x] 4.4 **Green** — complete the handler wiring with limit clamp + 404 + 502 mapping until 4.3 passes

## 5. `GET /api/lines/:lineId` + TTL cache (TDD)

- [x] 5.1 **Red** — translator tests for lines: `line-response.json` → mapping to `{ line, shape, directions[] }`; assert `directions` has 2 entries with non-empty `stops[]` and `scheduledDepartures[]`; `meta.date` in TZ Montevideo
- [x] 5.2 **Green** — implement `viewer/lib/otp/translate-line.ts` + GraphQL query + `viewer/app/api/lines/[lineId]/route.ts` until 5.1 passes
- [x] 5.3 **Red** — TTL cache tests: two consecutive `/api/lines/4` calls within 60 s → mocked `axios.post` called once. After advancing the injected clock 61 s → second call issues a new request. Cache key includes `(lineId, date)` — day rollover invalidates
- [x] 5.4 **Green** — implement `viewer/lib/util/ttl-cache.ts` (Map + expiresAt + injectable clock) and integrate it in the line handler until 5.3 passes. Verify with negative tests that plan/arrivals/vehicles do NOT consult the cache

## 6. `GET /api/lines/:lineId/vehicles` (TDD)

- [x] 6.1 **Red** — decoder + filter tests: given `viewer/test/fixtures/bridge/vehicle-positions.pb`, assert that `GET /api/lines/4/vehicles` returns only entities with `label === "L4"` (or `trip.routeId === "4"`); mapping to `{ lineId, vehicles[], meta }`; bridge unreachable → 200 with `vehicles: []` + `meta.realtime_available: false`. Also assert no bridge URL in any logged error
- [x] 6.2 **Green** — implement `viewer/lib/bridge/client.ts` (axios arraybuffer GET + 5 s timeout + URL sanitization), `viewer/lib/bridge/decode-vehicles.ts` (decode + per-line filter), `viewer/app/api/lines/[lineId]/vehicles/route.ts` until 6.1 passes
- [x] 6.3 **Red** — E2E test: mocked bridge returns fixture → 200 with right shape; mocked bridge fails → 200 with empty vehicles
- [x] 6.4 **Green** — finish the handler wiring until 6.3 passes. Verify via test that two consecutive calls ALWAYS hit the bridge (no cache)

## 7. Stubs + aggregated healthz + CORS

- [x] 7.1 Add `viewer/app/api/tickets/route.ts` and `viewer/app/api/pois/route.ts` returning `501` with the documented JSON body (per spec R-09) — handlers of a few lines each, no TDD
- [x] 7.2 **Red** — aggregated healthz tests: mock OTP `/otp/actuators/health` + bridge `/healthz`; assert the full matrix from spec R-10 (ok / degraded / down across combinations); reasonable `viewer.uptime_seconds`; `viewer.next_version` populated
- [x] 7.3 **Green** — implement `viewer/app/api/healthz/route.ts` with parallel probes (axios + 1 s timeouts) and classification logic until 7.2 passes
- [x] 7.4 **Red** — CORS middleware tests: `VIEWER_CORS_ORIGINS=""` → responses lack `Access-Control-Allow-Origin`. `VIEWER_CORS_ORIGINS="http://localhost:3000"` + matching origin → header present. `VIEWER_CORS_ORIGINS="*"` → no CORS + warning logged
- [x] 7.5 **Green** — implement CORS handling. Next.js App Router pattern: a `middleware.ts` at `viewer/` root that gates `/api/*` routes; reads the env at module load; applies headers per request. Until 7.4 passes — *Test corre bajo `// @vitest-environment node` (happy-dom strippa el header `Origin`; Node lo permite). Mantengo la implementación de middleware idéntica al diseño.*

## 8. Compose integration

- [x] 8.1 Add the `viewer` service to the root `docker-compose.yml` (`build: ./viewer`, `env_file .env` with `required: false`, `ports: "${VIEWER_PORT:-8080}:8080"`, `depends_on: { otp: { condition: service_healthy }, bridge: { condition: service_healthy } }`, `restart: unless-stopped`)
- [x] 8.2 Add a `healthcheck:` block for `viewer` that invokes `node bin/healthcheck.js` (alpine has no curl/bash; same principle as the bridge)
- [x] 8.3 **Remove** OTP's host port mapping from `compose.override.yml.example` — the viewer now owns the public port 8080. The CI override (`compose.override.ci.yml`) keeps its OTP mapping for `otp-smoke.yml`

## 9. CI workflows

- [x] 9.1 Create `.github/workflows/viewer.yml` — lint + vitest + `next build`. Triggers on push/PR to `viewer/**` and the workflow file
- [x] 9.2 Create `.github/workflows/viewer-smoke.yml` — full stack in fixture mode. setup-node 26 + setup-java 21 + uv. `docker compose up -d otp bridge viewer` with `ORIGIN_AVL=file://./bridge/test/fixtures/avl-sample.xml`. Poll `/api/healthz` until `ok|degraded`. Hit `/api/plan` (Buquebus → PdT pinned weekday+time per `otp-smoke.yml`), `/api/lines/4`, `/api/lines/4/vehicles`. Fetch root page (`GET /`) and assert disclaimer copy is in the HTML
- [x] 9.3 Add `actions/upload-artifact@v4` step (`if: always()`) uploading `smoke-out/` with responses, root HTML, `healthz.json`, `viewer.log`, `otp.log`, `bridge.log`. 14d retention
- [x] 9.4 Verify `viewer-smoke.yml` does NOT reference `secrets.ORIGIN_AVL` — fixture mode only (per spec R-11's secret-handling inheritance from `bridge-gtfs-rt`) — *Verified: única ocurrencia es un comentario explicativo (line 77), no hay interpolación `${{ secrets.ORIGIN_AVL }}`.*

## 10. Documentation + PRD updates

- [x] 10.1 Create `viewer/README.md` (Spanish primary per spec R-12): stack, local boot via `docker compose up viewer`, dev mode via `npm run start:dev`, prereq of `.env` + `data/output/gtfs.zip`, endpoint table, chrome layer description, i18n flow with `next-intl`, link to the spec
- [x] 10.2 Create `viewer/README.en.md` mirror with the `Español` / `English` cross-link header
- [x] 10.3 Update root `README.md` + `README.en.md`: add badges for `viewer.yml` and `viewer-smoke.yml`; add the `viewer/` link in the Documentation section; refresh the "Stack" section to show the three services (otp + bridge + viewer) with the viewer as the only public-facing one
- [x] 10.4 Update `deployment/README.md` + `.en.md`: refresh the stack diagram showing the viewer as the single entry point; rewrite the "Ports" section (only viewer exposes `:8080` to the host)
- [x] 10.5 Update PRD `docs/prd/mvp-v0.md`:
  - §3.3 stack diagram: collapse BFF + viewer rows into a single "Next.js app" row
  - §6.1 service table: replace the two rows with one ("Next.js: viewer + API routes")
  - §6.3 flow diagram: "turista → viewer → BFF → OTP" becomes "turista → Next.js → OTP / bridge"
  - §6.4 boundaries: clarify the single public-facing container
  - §10.1 Q4: mark resolved with "Next.js (App Router, React, TypeScript)"
  - §10.1 Q5: mark resolved with "`next-intl`"
  - §11 mapping: remove the `bff-api-and-routes` row, rename `viewer-shell-and-i18n` to `viewer-shell-and-api` with the updated scope (shell + i18n + API routes)

## 11. Verification

- [x] 11.1 Run `npm test` inside `viewer/` and confirm the whole TDD suite (groups 2-7) is green — *55/55 tests passing across 13 files. Lint también verde (config simplificada — ver design D-17 si se readmite eslint-config-next).*
- [ ] 11.2 Run `docker compose up viewer` locally (with `.env` pointing the bridge at file:// fixture mode); confirm `GET /api/healthz` → 200 with `status: "ok"`; `GET /` → 200 HTML containing the disclaimer copy — *Smoke local pendiente de máquina del usuario (Docker + `.env` + `data/output/gtfs.zip`). El equivalente CI corre en `viewer-smoke.yml`.*
- [ ] 11.3 Issue real requests against the local stack:
   - `POST /api/plan` (Buquebus → PdT pinned) → 200 with itineraries
   - `GET /api/lines/4` → 200 with shape + directions
   - `GET /api/lines/4/vehicles` → 200; with the fixture loaded, expect live-position entries for L4
   - `GET /api/stops/<known-stop-id>/arrivals` → 200 with arrivals
   - `GET /api/tickets` → 501
   - `GET /` → 200 HTML; inspect via curl that the disclaimer copy appears in the response body
   — *Mismo motivo que 11.2: equivalente CI cubierto por `viewer-smoke.yml`.*
- [ ] 11.4 Stop the bridge (`docker compose stop bridge`) and confirm `/api/lines/4/vehicles` still returns 200 with `vehicles: []` + `meta.realtime_available: false`; `/api/healthz` reports `degraded` — *Test unitario de degradación cubre el path (`route.test.ts` "bridge unreachable → 200 con empty vehicles"); validación end-to-end pendiente de smoke local.*
- [ ] 11.5 Stop OTP (`docker compose stop otp`) and confirm `/api/plan` returns 502; `/api/healthz` reports `down`; the root page still renders (the chrome doesn't depend on OTP/bridge) — *Tests unitarios cubren el path (`plan/route.test.ts` mockea OTP down → 502; `healthz/route.test.ts` valida la matriz status); validación end-to-end pendiente de smoke local.*
- [x] 11.6 Run `openspec validate --all --strict --no-interactive` and confirm green — *4/4 verde (3 specs + 1 change).*
