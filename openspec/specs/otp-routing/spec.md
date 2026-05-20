## Purpose

Motor de trip planning del stack v0: OpenTripPlanner 2 desplegado como service Docker Compose que consume los outputs de [`gtfs-static-data`](../gtfs-static-data/spec.md) (`data/output/gtfs.zip` + `data/colonia.osm.pbf`) y expone una API de routing en la red interna de Docker para los specs downstream (`bridge-gtfs-rt`, `bff-api-and-routes`, `viewer-od-mode`). Cubre la definición del service en compose, los archivos de config de OTP, los mounts read-only, el presupuesto de heap JVM, el contrato de updaters GTFS-RT que el bridge SHALL cumplir, el healthcheck, y el workflow de CI smoke que ejercita el path de boot end-to-end.

## Requirements

### Requirement: The repository SHALL declare an OpenTripPlanner 2 service in `docker-compose.yml`

El repo SHALL incluir un `docker-compose.yml` en la raíz del repositorio que declare un service llamado `otp`, usando la imagen upstream `opentripplanner/opentripplanner` pineada a un tag específico (sin `:latest`). El tag de la imagen SHALL ser `2.10.0_2026-05-13T17-42` (o un tag pineado posterior bumpeado vía PR + smoke test).

El service SHALL escuchar en el puerto 8080 del container y SHALL NOT exponer ese puerto al host por default. Otros services en la misma red Docker lo alcanzan vía `http://otp:8080`.

#### Scenario: Compose file declares an otp service with a pinned image
- **WHEN** se inspecciona el repositorio y se lee `docker-compose.yml`
- **THEN** declara un service llamado `otp` cuya `image` es `opentripplanner/opentripplanner:<tag>` con un tag explícito (no `latest`)

#### Scenario: OTP is not exposed on the host by default
- **WHEN** se inspecciona el service `otp` en el `docker-compose.yml` base
- **THEN** no tiene mapeo `ports:` (los consumidores en el host pueden seguir usando `docker compose port otp 8080` o un `compose.override.yml` para debug)

### Requirement: OTP SHALL mount the GTFS feed, OSM extract, and config files read-only

El service `otp` SHALL montar los siguientes archivos en el container, todos read-only (`:ro`), en los paths indicados:

| Host path | Container path |
|---|---|
| `./data/output/gtfs.zip` | `/var/opentripplanner/gtfs.zip` |
| `./data/colonia.osm.pbf` | `/var/opentripplanner/colonia.osm.pbf` |
| `./deployment/otp/otp-config.json` | `/var/opentripplanner/otp-config.json` |
| `./deployment/otp/router-config.json` | `/var/opentripplanner/router-config.json` |

El mount de `gtfs.zip` referencia el output de `tooling/scripts/build_gtfs_zip.py` (capability `gtfs-static-data`). El script de build SHALL ser invocado antes de `docker compose up otp` para que el archivo exista.

`otp-config.json` SHALL habilitar el feature `ActuatorAPI` (off por default en OTP 2.10), que gatea el endpoint `/otp/actuators/health` requerido por el requirement del healthcheck.

#### Scenario: Required mounts are present
- **WHEN** se inspecciona la definición del service `otp`
- **THEN** los cuatro mounts de arriba están declarados, cada uno con el flag `:ro`

#### Scenario: ActuatorAPI feature is enabled
- **WHEN** se parsea `deployment/otp/otp-config.json`
- **THEN** setea `otpFeatures.ActuatorAPI = true`

#### Scenario: Build precondition is documented
- **WHEN** se inspecciona `deployment/README.md`
- **THEN** documenta que `uv run --directory tooling python scripts/build_gtfs_zip.py` debe correrse antes de `docker compose up otp`

### Requirement: OTP SHALL build its graph at container start

El command del service SHALL incluir `--build --serve` (o el equivalente para la versión de OTP pineada) de modo que OTP construya el grafo de routing desde los inputs montados al startup y luego sirva queries HTTP. El grafo SHALL NOT persistirse a un volumen Docker en v0; cada restart lo reconstruye.

#### Scenario: Container command builds and serves
- **WHEN** se inspecciona el command del service `otp`
- **THEN** incluye los flags `--build` y `--serve` (el `/docker-entrypoint.sh` upstream injecta `/var/opentripplanner/` como base path automáticamente)

#### Scenario: No graph persistence volume
- **WHEN** se inspecciona el service `otp`
- **THEN** no declara un volumen nombrado para los datos del grafo (solo los mounts read-only de `gtfs.zip`, `colonia.osm.pbf`, `otp-config.json`, `router-config.json`)

### Requirement: OTP SHALL run with a pinned JVM heap budget

El service SHALL setear `JAVA_TOOL_OPTIONS` (o la env var OTP-específica si la imagen documenta una) para aplicar `-Xmx1g -Xms512m`. Estos valores capean la JVM a 1 GB de heap y arrancan con 512 MB asignados.

#### Scenario: JVM heap flags are declared
- **WHEN** se inspecciona el environment del service `otp`
- **THEN** una env var setea `-Xmx1g` y `-Xms512m`

### Requirement: `router-config.json` SHALL declare two GTFS-RT updaters pointing at the bridge

`deployment/otp/router-config.json` SHALL contener un array `updaters` con exactamente dos entries que pollean al service sibling `bridge` para datos realtime:

1. Un updater `vehicle-positions` con `feedId: "sol-antigua"`, `url: "http://bridge:3001/gtfs-rt/vehicle-positions.pb"`, `frequency: "15s"`, `fuzzyTripMatching: true`.
2. Un updater `stop-time-updater` (TripUpdates) con `feedId: "sol-antigua"`, `url: "http://bridge:3001/gtfs-rt/trip-updates.pb"`, `frequency: "30s"`.

El service `bridge` SHALL ser definido por un change posterior (`bridge-gtfs-rt`). Hasta entonces, OTP va a loguear errores de conexión a la frecuencia configurada y seguir sirviendo el feed estático sin augmentation realtime — ese comportamiento es aceptable para el demo v0.

#### Scenario: Two updaters are declared
- **WHEN** se parsea `deployment/otp/router-config.json`
- **THEN** el array `updaters` tiene exactamente dos entries con valores de `type` `vehicle-positions` y `stop-time-updater`

#### Scenario: Updater URLs target the bridge contract
- **WHEN** se inspeccionan los updaters
- **THEN** sus campos `url` son `http://bridge:3001/gtfs-rt/vehicle-positions.pb` y `http://bridge:3001/gtfs-rt/trip-updates.pb` respectivamente

#### Scenario: Updaters tolerate a missing bridge at startup
- **WHEN** se corre `docker compose up otp` sin el service bridge corriendo
- **THEN** OTP arranca exitosamente, loguea los intentos fallidos del updater, y responde a queries de routing usando el feed estático

### Requirement: OTP SHALL expose a healthcheck endpoint and the compose service SHALL declare a healthcheck

El container de OTP SHALL exponer `GET /otp/actuators/health` devolviendo `200 OK` una vez que el grafo está construido y el servidor HTTP está listo. El service `otp` del compose SHALL declarar un bloque `healthcheck:` que probe este endpoint y espere hasta 60 segundos al startup.

El probe SHALL solo depender de binarios que vienen en la imagen upstream de OTP (`bash` con `/dev/tcp` alcanza; `curl`/`wget` NO están presentes en `opentripplanner/opentripplanner:2.10.*`).

#### Scenario: Health endpoint returns 200 when ready
- **WHEN** el container terminó de construir el grafo y está sirviendo
- **THEN** `GET http://otp:8080/otp/actuators/health` desde dentro de la red Docker devuelve `200`

#### Scenario: Compose healthcheck is declared
- **WHEN** se inspecciona el service `otp`
- **THEN** declara un `healthcheck:` cuyo `test` probea `GET /otp/actuators/health` en `http://localhost:8080` y trata `200` como healthy, con `start_period: 60s` y un interval/retries razonable

### Requirement: A CI workflow SHALL smoke-test OTP on changes to its inputs

Un workflow `.github/workflows/otp-smoke.yml` SHALL correr en push/PR que toque cualquiera de: `deployment/otp/**`, `docker-compose.yml`, `compose.override.ci.yml`, `data/*.txt`, `data/colonia.osm.pbf`, `tooling/scripts/build_gtfs_zip.py`, `tooling/pyproject.toml`, `tooling/uv.lock`, o el workflow file mismo. El job SHALL:

1. Checkout del repo.
2. Construir `gtfs.zip` vía `uv run --directory tooling python scripts/build_gtfs_zip.py`.
3. Levantar el service `otp` con `docker compose up -d otp` (usando `compose.override.ci.yml` para publicar el puerto 8080 al runner).
4. Pollear `http://localhost:8080/otp/actuators/health` hasta `200 OK` o timeout de 90 s.
5. Lanzar una query de trip-plan vía el endpoint GraphQL de OTP 2.10 (`POST /otp/gtfs/v1`) con dos coordenadas de Colonia urbano **pineadas a una fecha de día de semana en servicio y una hora dentro del rango de operación** (de modo que el resultado del smoke sea independiente de cuándo el runner se dispara) y assertar que la respuesta contiene al menos un itinerary.
6. Subir el request, el response, los response headers, el status, el summary, y el output de `docker compose logs otp` como un artifact del workflow (`actions/upload-artifact@v4`, `if: always()`, retención ~14 días) para que los reviewers puedan inspeccionar el comportamiento real de OTP desde una run de CI.
7. Bajar el service.

El workflow SHALL salir no-cero si cualquiera de esos pasos falla.

> **Nota sobre el path de la routing API:** OTP 2.10 removió el endpoint legacy REST `/otp/routers/default/plan` y solo expone routing vía GraphQL en `POST /otp/gtfs/v1`. El workflow de CI y el BFF (spec `bff-api-and-routes`) consumen ese endpoint GraphQL.

> **Nota sobre el pin de date/time:** sin el pin, la GraphQL `plan` query usa la hora actual del runner por default, lo que hace al smoke flaky fuera de horario de servicio (Sol Antigua urbano corta ~23:18 los días de semana según `data/stop_times.txt`). La fecha+hora pineada SHALL caer dentro de `feed_info.feed_start_date` / `feed_end_date` y en un día que `data/calendar.txt` marca en servicio.

#### Scenario: Workflow runs on input changes
- **WHEN** un pull request modifica `deployment/otp/router-config.json`
- **THEN** el workflow `otp-smoke` se dispara para ese PR

#### Scenario: Workflow asserts at least one itinerary
- **WHEN** el smoke step lanza una GraphQL `plan` query en `POST /otp/gtfs/v1` desde `(-34.471, -57.852)` a `(-34.449, -57.815)` con un `date`+`time` pineado a un día de semana dentro del feed validity window durante horario de servicio, y `transportModes: [{mode: TRANSIT},{mode: WALK}]`
- **THEN** la respuesta es `200 OK`, `data.plan.itineraries` no está vacío, y `data.plan.itineraries[0].legs[0]` existe

#### Scenario: Workflow uploads the smoke results as an artifact
- **WHEN** el job de smoke termina (success o failure)
- **THEN** un step `actions/upload-artifact@v4` subió un directorio conteniendo al menos: el body del request mandado a OTP, el código de status HTTP, los headers de la respuesta, el body JSON de la respuesta, un summary human-readable del itinerary devuelto, y el output capturado de `docker compose logs otp`

### Requirement: Deployment documentation SHALL describe the OTP service end-to-end

Un `deployment/README.md` SHALL documentar, como mínimo:

- Cómo construir `gtfs.zip` antes de levantar OTP.
- El command `docker compose up otp` y el tiempo típico de build del grafo de 5–15 segundos.
- El puerto del container (`8080`), la ausencia de mapping al host, y cómo habilitar un puerto de debug vía `compose.override.yml`.
- La configuración del heap JVM y cómo overridearla si hace falta.
- El comportamiento esperado cuando el bridge no está corriendo todavía (los errores de updater se loguean; OTP sigue sirviendo el feed estático).
- Dónde vive el spec contract (link a `openspec/specs/otp-routing/spec.md`).

#### Scenario: deployment/README.md exists and is linked from the root README
- **WHEN** se inspecciona el repositorio
- **THEN** `deployment/README.md` está presente, y el `README.md` root lo referencia desde su sección de Documentation / Stack
