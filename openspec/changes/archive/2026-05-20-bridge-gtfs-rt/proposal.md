## Why

El PRD v0 ([`docs/prd/mvp-v0.md`](../../../docs/prd/mvp-v0.md) §6.1, §6.3) define la capa de realtime como un *bridge*: un service interno que poolea el AVL de Sol Antigua, matchea los markers contra el feed estático del [`gtfs-static-data`](../../specs/gtfs-static-data/spec.md) y emite GTFS-Realtime en los endpoints `.pb` que OTP ya está esperando. El spec previo [`otp-routing`](../../specs/otp-routing/spec.md) (R-05) declara el contrato de URLs (`http://bridge:3001/gtfs-rt/{vehicle-positions,trip-updates}.pb`, `feedId: sol-antigua`, fuzzy trip matching habilitado) — pero el service todavía no existe. Sin esta capability, el demo `docker compose up` arranca OTP rutando solo sobre el feed estático y loguea errores de conexión cada 15/30 s. Para cerrar el v0 (criterio de aceptación 8: "el bridge poolea AVL cada 30 s sin caídas durante ≥48 hs continuas"; criterio 13: "el feed GTFS-RT del bridge pasa `gtfs-realtime-validator` (MobilityData) sin errores P0/P1") tiene que existir.

## What Changes

- Sumar el service `bridge` al `docker-compose.yml` del repo (NestJS sobre la imagen Node oficial, expone HTTP en el puerto interno 3001).
- Crear el subdirectorio `bridge/` en la raíz del repo con: app NestJS, módulos de poller / parser / matcher / emitter, tests, `Dockerfile`.
- Inyectar la URL del AVL upstream vía variable de entorno `ORIGIN_AVL` (nunca committeada al repo; en runtime se carga desde `.env` local, en CI desde un GitHub Secret homónimo). El AVL nunca se expone al host ni a la red pública, y la URL en sí queda fuera de cualquier artefacto versionado.
- Pollear el AVL cada 30 s, parsear XML codificado en ISO-8859-1, matchear cada marker contra el feed GTFS Schedule (`agency`, `routes`, `trips`, `stops`, `stop_times` montados desde `data/`) para derivar `trip_id`, `stop_id` actual / próxima, delay, posición lat/lon, heading y velocidad.
- Emitir dos endpoints `.pb` cumpliendo el spec GTFS-RT v2.0:
  - `GET /gtfs-rt/vehicle-positions.pb` — posiciones live por vehículo.
  - `GET /gtfs-rt/trip-updates.pb` — TripUpdates con delay/ETA por stop.
- Exponer `GET /healthz` interno con el estado del último poll (success/timestamp/latency/miss rate).
- Implementar resiliencia: backoff exponencial ante errores upstream, fallback a `FeedMessage` vacío con header válido cuando el último poll falló, alertas locales (logs estructurados) si el miss rate de los últimos N polls supera 10 %.
- Sumar workflow CI `bridge-rt-validate.yml`: arranca el bridge con un fixture de XML AVL (capturado y committeado), llama los dos endpoints `.pb`, los corre contra `gtfs-realtime-validator` de MobilityData y asserta cero errores P0/P1.
- Sumar workflow CI `bridge.yml` (paralelo a `tooling.yml`) que corre lint + tests del subdirectorio `bridge/`.
- Documentar end-to-end en `bridge/README.md` (+ `.en.md` mirror) y enlazar desde `deployment/README.md` (sección "Realtime") y el root README.

## Capabilities

### New Capabilities

- `bridge-gtfs-rt`: bridge AVL → GTFS-Realtime. Cubre el contrato del service `bridge` (puertos, URLs, formato de payload, frecuencia de poll), el algoritmo de matching marker→trip, las garantías de resiliencia (fallback empty feed, backoff), y el smoke test contra `gtfs-realtime-validator` de MobilityData.

### Modified Capabilities

_Ninguna._ El contrato de URLs y frecuencias declarado en R-05 de `otp-routing` ya describe lo que el bridge tiene que exponer; esta capability **satisface** ese contrato sin modificarlo. `gtfs-static-data` se consume sin tocar.

## Impact

- **New files (al aplicar):**
  - `bridge/` (NestJS workspace): `package.json`, `tsconfig.json`, `src/`, `test/`, `Dockerfile`, `README.md`, `README.en.md`.
  - `bridge/test/fixtures/avl-sample.xml` — captura representativa del AVL upstream para tests + CI sin depender de la red.
  - `.github/workflows/bridge.yml` — lint + tests del subdirectorio.
  - `.github/workflows/bridge-rt-validate.yml` — smoke con `gtfs-realtime-validator`.
  - Posible `deployment/bridge/` para config compose-side si hace falta (decisión spec/design-level).
- **Modified files (al aplicar):**
  - `docker-compose.yml` — sumar service `bridge` como sibling de `otp` (sin host port mapping; ambos en la misma red Docker).
  - `.env.example` (a crear en este change si no existe) — declarar `ORIGIN_AVL`, `POLL_INTERVAL_MS`, `BRIDGE_PORT`.
  - `.gitignore` — sumar `.env`.
  - `README.md` / `README.en.md` — badge del workflow + link a `bridge/README.md`.
  - `deployment/README.md` / `.en.md` — sección "Realtime" referenciando el bridge, ahora que la sección "Bridge ausente — comportamiento esperado" se vuelve la del path *con* bridge.
- **Unblocks:**
  - `bff-api-and-routes` — el BFF puede proxear `/api/vehicle-positions` y `/api/stops/:id/arrivals` con datos live.
  - `viewer-stop-info-mode` — ETAs live vs programados (criterio de aceptación 4).
  - `viewer-line-schedule-mode` — posición live de vehículos (criterio de aceptación 5).
- **Consume:**
  - `gtfs-static-data` — usa `data/agency.txt`, `data/routes.txt`, `data/trips.txt`, `data/stops.txt`, `data/stop_times.txt`, `data/calendar.txt`, `data/calendar_dates.txt` para el matching.
  - `otp-routing` (R-05) — respeta las URLs, frecuencias y `feedId` declarados ahí; emite `FeedMessage` con esos parámetros.
- **External dependencies (runtime):**
  - El endpoint AVL del operador (URL gestionada fuera del repo; ver riesgo §9 del PRD para las condiciones de acceso). XML codificado en ISO-8859-1.
  - Node.js 26 (status `Current` al momento del spec, Active LTS desde 2026-10-28; versión exacta `node:26-alpine` pineada en el `Dockerfile` y en `package.json` engines — ver design D-03).
  - npm packages: `@nestjs/*` (incluyendo `@nestjs/axios` para el `HttpService` del poller), `axios` (peer de `@nestjs/axios`), `fast-xml-parser`, `iconv-lite`, `gtfs-realtime-bindings` (todos commodity, MIT/ISC).
- **Out of scope (explícito):**
  - **Persistencia histórica de markers en Postgres.** El PRD §4 la lista como "soportada pero off por default vía env"; en este v0 ni siquiera se incluye el code path. Es un change posterior si se decide tracker forensics.
  - **`occupancy_status` en GTFS-RT.** PRD §4 / D11 del relevamiento: firme no en v0 (no hay fuente live de ocupación).
  - **Service Alerts.** PRD §4: sin fuente formal en Sol Antigua.
  - **Autenticación / autorización del bridge.** PRD §6.4: solo red interna de Docker; el BFF no proxea estos endpoints (los polea OTP).
  - **Modelo multi-operador.** PRD §10.2 / L7: v0.2+.
- **CI / deploy:**
  - El compose pasa a tener dos services con healthchecks (otp ya tenía uno; bridge agrega el suyo).
  - El criterio de aceptación 13 del PRD ("feed GTFS-RT pasa validator de MobilityData sin P0/P1") se cubre con el workflow `bridge-rt-validate.yml`.
- **Open questions diferidas al `design.md`:**
  - **Q1 del PRD §10.1:** ¿`trip_id` derivado del `srv` del operador o sintético `route-service-dir-time`?
  - **Match algorithm:** geometría más cercana (snap a `shapes.txt`) vs heurística por `route_id` + dirección + hora.
  - **Manejo de markers que no matchean ningún trip activo** (drop, log, contribuir vacío).
  - **Estrategia exacta de backoff** y umbrales de alerta.
