## Why

El PRD v0 ([`docs/prd/mvp-v0.md`](../../../docs/prd/mvp-v0.md) §6.1, §6.3) define el **BFF** como el único entry point público del stack: sirve el viewer estático, proxea las APIs internas (OTP, bridge), y traduce el routing GraphQL de OTP a una superficie REST simple que el viewer consume. Sin esta capability, el viewer no puede hablar con OTP/bridge directamente — esos services viven en la red interna de Docker, sin host port mapping (per `otp-routing` D-06 y `bridge-gtfs-rt` R-01). El BFF también es lo único que el dominio público del demo expone: todo lo demás queda detrás suyo.

Cierra los criterios de aceptación del PRD §8.1 #1-#5 que necesitan un endpoint HTTP para el viewer: itinerarios O→D (#1, #2, #3), próximos buses en una parada (#4), vista de línea con vehículos live (#5).

## What Changes

- Crear el subdirectorio `bff/` en la raíz del repo: Express + TypeScript, sin NestJS (overkill para la superficie del BFF — un proxy fino sobre OTP + bridge).
- Sumar el service `bff` al `docker-compose.yml` raíz como sibling de `otp` y `bridge`. **Único service con host port mapping** (default `8080:8080`) — es el entry point público.
- Endpoints REST que el viewer consume:
  - `POST /api/plan` — traduce a la GraphQL `plan` query de OTP (`POST /otp/gtfs/v1`); devuelve `{ itineraries: [{ duration, walkDistance, legs: [...] }] }` JSON shape.
  - `GET /api/stops/:stopId/arrivals` — próximos buses en una parada con ETAs vía OTP GraphQL `stop(id).stoptimesForServiceDate`; marca cada entry como `realtime` cuando OTP tiene RT data del bridge.
  - `GET /api/lines/:lineId` — trazado + paradas + horarios programados del día de una línea (route + shape + stop_times); GraphQL `route` query.
  - `GET /api/lines/:lineId/vehicles` — posiciones live de los vehículos en una línea. Fetchea `/gtfs-rt/vehicle-positions.pb` del bridge, decodifica con `gtfs-realtime-bindings`, filtra por `lin == lineId`. (OTP 2.10 no expone vehicle positions como top-level GraphQL field — verificado durante el smoke del bridge.)
  - `GET /api/healthz` — agregado: status del BFF + última latencia conocida de OTP + última latencia del bridge.
- Stubs documentados (PRD §6.1): `GET /api/tickets` y `GET /api/pois` devuelven `501 Not Implemented` con un body explicativo que apunta al spec.
- Static file serving del viewer build (decisión spec-level: `viewer/dist/` → `express.static`). Path final del build lo decide `viewer-shell-and-i18n`; el BFF acepta el path como env var `VIEWER_BUILD_DIR`.
- CORS configurable vía env `BFF_CORS_ORIGINS` (lista separada por comas). En v0 default = origin del viewer dev server (`http://localhost:5173` u otro, depende del spec del viewer). En prod = `null` (mismo origin que el static serve, no requiere CORS).
- Caching in-memory de respuestas no-RT pesadas: trazado de línea + lista de stops + scheduled stop_times del día. TTL corto (60 s) suficiente para que el viewer no martille al stack en cada navegación.
- Sumar workflow CI `bff.yml` — lint + tests del subdirectorio.
- Sumar workflow CI `bff-smoke.yml` — arranca el stack completo (otp + bridge + bff) en modo fixture, hace requests a los endpoints del BFF y assert sobre la shape de las respuestas. Sube artifact con responses + healthz + logs.

## Capabilities

### New Capabilities

- `bff-api-and-routes`: Backend-for-frontend del stack v0. Cubre el service Express, los endpoints REST que consume el viewer, el static serve, el manejo de CORS, los stubs documentados, y el contrato de healthz agregado.

### Modified Capabilities

_Ninguna._ El BFF **consume** `otp-routing` (R-07 GraphQL endpoint) y `bridge-gtfs-rt` (R-05 `.pb` endpoints, R-07 healthz) sin modificarlos. `gtfs-static-data` se consume indirectamente (vía OTP); el BFF no toca `data/*.txt` directo.

## Impact

- **New files (al aplicar):**
  - `bff/` (Express workspace): `package.json`, `tsconfig.json`, `src/`, `test/`, `Dockerfile`, `README.md`, `README.en.md`, `bin/healthcheck.js`.
  - `bff/test/fixtures/` — payloads de ejemplo de OTP GraphQL + bridge `.pb` para los unit tests.
  - `.github/workflows/bff.yml` — lint + tests del subdirectorio.
  - `.github/workflows/bff-smoke.yml` — smoke end-to-end stack.
- **Modified files (al aplicar):**
  - `docker-compose.yml` — sumar service `bff` con `build: ./bff`, `env_file: .env`, `ports: "8080:8080"`, `depends_on: { otp: ..., bridge: ... }`. **OTP pierde su host port mapping del `compose.override.yml.example`** — solo CI lo necesita en CI; en runtime normal, el BFF es el único puerto público.
  - `compose.override.ci.yml` — sumar bridge ports si hace falta para smoke del BFF.
  - `.env.example` — sumar `BFF_PORT=8080`, `OTP_BASE_URL=http://otp:8080`, `BRIDGE_BASE_URL=http://bridge:3001`, `BFF_CORS_ORIGINS=` (vacío por default), `VIEWER_BUILD_DIR=/var/bff/viewer-dist`.
  - `README.md` / `.en.md` — badge + link a `bff/README.md`. Sección "Stack" actualizada.
  - `deployment/README.md` / `.en.md` — sumar `bff` al diagrama del stack; documentar que es el único service con host port mapping.
- **Unblocks:**
  - `viewer-shell-and-i18n` — el viewer ya tiene un backend HTTP estable contra el cual hacer fetch.
  - `viewer-od-mode` — endpoint `POST /api/plan` listo.
  - `viewer-stop-info-mode` — endpoint `GET /api/stops/:stopId/arrivals` listo.
  - `viewer-line-schedule-mode` — endpoints `GET /api/lines/:lineId` + `/vehicles` listos.
- **Consume:**
  - `otp-routing` R-07: GraphQL endpoint `POST /otp/gtfs/v1` (plan, route, stop, stoptimes).
  - `bridge-gtfs-rt` R-05: `GET /gtfs-rt/vehicle-positions.pb` para vehicles-por-línea.
  - `bridge-gtfs-rt` R-07: `GET /healthz` para el agregado de healthz del BFF.
- **External runtime dependencies:**
  - Node.js 26 (mismo pin que el bridge per design D-03 de `bridge-gtfs-rt`).
  - npm packages: `express`, `cors`, `axios`, `gtfs-realtime-bindings`, `zod` (validación de request bodies del viewer). Todos commodity, MIT/ISC.
- **Out of scope (explícito):**
  - **Implementación real de `/api/tickets` y `/api/pois`.** Stubs documentados que retornan `501`. Los datos de tickets dependen de un acuerdo con Sol Antigua que está abierto; los POIs son v0.1+.
  - **Autenticación / autorización.** PRD §6.4: producto público, sin auth en v0.
  - **Rate limiting.** Demo cerrado, sin público abierto. Se suma si v0.1+ pasa a público.
  - **Multi-tenancy / multi-operador.** Spec siguiente del v0.2+.
  - **Server-side analytics.** PRD §4: out of v0.
  - **WebSocket / SSE push** para vehicle positions. El viewer va a poll-ear `/api/lines/:id/vehicles` cada N segundos.
- **CI / deploy:**
  - Tres services healthy en `docker compose up` (otp + bridge + bff). El host solo ve `:8080` (BFF).
  - El criterio de aceptación 10 del PRD (`docker compose up` arranca el stack completo en <5 min) se cubre con los tres services y este BFF.
- **Open questions diferidas al `design.md`:**
  - Shape JSON exacto de cada endpoint REST (subset de los fields GraphQL que el viewer realmente usa).
  - Estrategia de errores: ¿propagar `502 Bad Gateway` cuando OTP/bridge están caídos, o degradar a respuestas con `meta.realtime_available: false`?
  - Path del build del viewer y cómo el BFF lo descubre (mount Docker volume vs build-multi-stage).
  - Versionado de la API (`/api/v1/...` vs `/api/...` sin versión).
