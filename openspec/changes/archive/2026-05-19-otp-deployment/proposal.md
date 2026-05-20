## Why

El PRD v0 ([`docs/prd/mvp-v0.md`](../../../docs/prd/mvp-v0.md) §6.1) eligió OpenTripPlanner 2 como el motor de planificación de viajes — la pieza que toma `(lat,lon) origen` + destino y devuelve un JSON con itinerarios (walking + bus + walking) para el viewer. La capa de datos estáticos ([`gtfs-static-data`](../../specs/gtfs-static-data/spec.md), archivada en `2026-05-18`) ya produce un `gtfs.zip` byte-determinístico y un `colonia.osm.pbf` clipeado. Falta el siguiente eslabón del mapeo del PRD §11: **desplegar OTP en Docker como el servicio que consume esos artefactos y expone una API de routing** para que el resto del stack (bridge, BFF, viewer) pueda construirse sobre él.

## What Changes

- Sumar OpenTripPlanner 2 (pin `v2.10`) como servicio en el `docker-compose.yml` del proyecto (creación inicial del compose si no existe).
- Definir los mounts: `data/output/gtfs.zip` (producido por `tooling/scripts/build_gtfs_zip.py`) y `data/colonia.osm.pbf`.
- Establecer el `router-config.json` con dos GTFS-RT updaters que poolean al **bridge** (servicio aún no creado; el spec `bridge-gtfs-rt` siguiente respetará las URLs declaradas acá como contrato): `/gtfs-rt/trip-updates.pb` y `/gtfs-rt/vehicle-positions.pb`.
- Definir el modo de build del grafo (al boot del container vs persistido en volumen) y el patrón de arranque end-to-end.
- Establecer puerto interno, healthz, presupuesto de memoria JVM, política de logs.
- Documentar el contrato de URLs que el bridge tiene que cumplir (input para `bridge-gtfs-rt`).
- Documentar el contrato de respuesta de `/otp/routers/default/plan` que el BFF/viewer van a consumir (input para `bff-api-and-routes` y `viewer-od-mode`).

## Capabilities

### New Capabilities

- `otp-routing`: motor de trip planning sobre la flota de Sol Antigua urbano Colonia. Contiene la config del container, los mounts, el `router-config.json`, las URLs del consumidor de GTFS-RT, y los endpoints HTTP expuestos al resto del stack.

### Modified Capabilities

_Ninguna — los requisitos de `gtfs-static-data` siguen intactos. Esta capability nueva consume ese spec sin modificarlo._

## Impact

- **New files (al aplicar el change):**
  - `docker-compose.yml` en la raíz del repo (o bajo `deployment/`, decisión spec-level — ver design D-01).
  - `deployment/otp/router-config.json` (o equivalente; ubicación final en design D-02).
  - `deployment/otp/build-config.json` si OTP lo requiere para el build inicial del grafo.
  - Posible `deployment/otp/Dockerfile` si se necesitan customizaciones sobre la imagen upstream (decisión design D-03).
  - `deployment/README.md` con instrucciones de boot, env vars, troubleshooting, link al `docs/release-process.md`.
- **New spec (al apply):** `openspec/specs/otp-routing/spec.md`.
- **Unblocks:**
  - `bridge-gtfs-rt` — sabe qué URLs tiene que servir (el contrato declarado en este spec).
  - `bff-api-and-routes` — sabe a qué URL de OTP proxear y qué forma de respuesta esperar.
  - `viewer-od-mode` — sabe qué estructura JSON va a recibir para renderear itinerarios.
- **Consume:** `gtfs-static-data` (los archivos `data/gtfs.zip` + `data/colonia.osm.pbf` ya commiteados).
- **External dependency:** Docker + docker-compose en el host de deploy. Java 25 (Temurin) embebido en la imagen de OTP (no aplicación nuestra). Imagen `opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42` o equivalente pineada.
- **CI:** sumar un workflow opcional `otp-smoke.yml` que arranca el container en CI y verifica que `/otp/actuators/health` responda 200 — decisión design D-08.
