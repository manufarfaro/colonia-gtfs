## ADDED Requirements

### Requirement: The repository SHALL declare a `bridge` service in `docker-compose.yml`

El repo SHALL extender el `docker-compose.yml` existente en la raíz con un service llamado `bridge`, construido desde un `Dockerfile` bajo `./bridge/`. El service SHALL escuchar en el puerto 3001 del container y SHALL NOT publicar ese puerto al host. OTP SHALL alcanzarlo vía `http://bridge:3001` en la red interna de Docker (el contrato de URLs pineado por [`otp-routing`](../../../specs/otp-routing/spec.md) R-05).

La definición del service SHALL incluir `restart: unless-stopped`, el env file `.env`, y un healthcheck (ver el requirement de healthz). La definición SHALL NOT publicar `ports:` en el archivo base — `compose.override.yml` / `compose.override.ci.yml` MAY publicar 3001 para debug local o CI.

#### Scenario: Compose file declares a bridge service
- **WHEN** se inspecciona el repositorio y se lee `docker-compose.yml`
- **THEN** declara un service llamado `bridge` cuyo `build` referencia `./bridge/` (o `./bridge` con Dockerfile default)

#### Scenario: Bridge is not exposed on the host by default
- **WHEN** se inspecciona el service `bridge` en el `docker-compose.yml` base
- **THEN** no tiene mapeo `ports:`; OTP lo alcanza como `http://bridge:3001` por la red interna de Docker

### Requirement: The bridge SHALL mount the static GTFS feed read-only

El service `bridge` SHALL montar el host path `./data` dentro del container en `/var/bridge/gtfs` con el flag `:ro`, de modo que el service pueda leer `agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt` (los inputs consumidos por [`gtfs-static-data`](../../../specs/gtfs-static-data/spec.md)). El bridge SHALL NOT depender del `gtfs.zip` bundleado — lee los `.txt` directos para no necesitar un path de unzip al boot.

#### Scenario: Static GTFS mount is declared read-only
- **WHEN** se inspecciona la definición del service `bridge`
- **THEN** declara `./data:/var/bridge/gtfs:ro`

#### Scenario: Required GTFS files are reachable at the mounted path
- **WHEN** el container arranca y lista `/var/bridge/gtfs/`
- **THEN** al menos `agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt` están presentes

### Requirement: The AVL upstream URL SHALL be treated as a secret — never committed, never logged, sourced from environment

El bridge SHALL leer la URL del AVL upstream desde la variable de entorno `ORIGIN_AVL`. Ningún artefacto en el repositorio (código fuente, tests, fixtures, docs, configs, examples, workflows de CI) SHALL contener la URL real — solo el placeholder literal `ORIGIN_AVL=<set-locally-or-via-ci-secret>` en `.env.example` está permitido.

La carga de configuración SHALL seguir estos canales por environment:

| Environment | Fuente de `ORIGIN_AVL` |
|---|---|
| Dev local / demo host | Archivo `.env` en la raíz del repo (gitignored). El operador copia `.env.example` a `.env` y completa el valor local. |
| GitHub Actions CI (cualquier workflow que necesite la URL real) | Un secret de repo (u org) llamado `ORIGIN_AVL`, expuesto al job vía `env: { ORIGIN_AVL: ${{ secrets.ORIGIN_AVL }} }`. El valor del secret SHALL NOT ser `echo`ado ni embebido en comandos loggeados. |
| Workflow de smoke del validator (`bridge-rt-validate.yml`) | `ORIGIN_AVL=file://<path-al-fixture>` — este workflow NO necesita la URL real porque usa un fixture committeado. Por lo tanto SHALL NOT referenciar `secrets.ORIGIN_AVL`. |

El repositorio SHALL incluir `.env.example` documentando las tres env vars (`ORIGIN_AVL=` sin valor, `POLL_INTERVAL_MS=30000`, `BRIDGE_PORT=3001`). El `.env` real SHALL estar listado en `.gitignore`.

El bridge SHALL NOT loguear el valor de `ORIGIN_AVL`, ni en logs de steady-state ni en mensajes de error. Los errores HTTP outgoing (`AxiosError` con su `config.url` típico, parse errors, timeouts) SHALL ser sanitizados — convertidos a errores de dominio cuyo mensaje no incluya la URL — antes de llegar a cualquier log appender. El output de healthz (R-07) tampoco SHALL incluir la URL.

#### Scenario: .env.example exists, real .env is gitignored, neither contains the real URL
- **WHEN** se inspecciona el repositorio
- **THEN** `.env.example` está presente en la raíz con `ORIGIN_AVL=` (sin valor), `POLL_INTERVAL_MS` y `BRIDGE_PORT` como placeholders; `.gitignore` contiene `.env`; ningún otro archivo trackeado contiene la URL real del upstream

#### Scenario: AVL URL is not echoed in logs or health responses
- **WHEN** el bridge loguea en cualquier nivel (info, warn, error) sobre el outcome de un poll, o responde a `GET /healthz`
- **THEN** la URL del AVL upstream no aparece en el output

#### Scenario: CI workflows pull the URL from secrets (when they need it at all)
- **WHEN** un workflow necesita pollear el AVL upstream real (es decir, no el path de fixture)
- **THEN** lee `ORIGIN_AVL` desde `${{ secrets.ORIGIN_AVL }}` y lo expone vía el bloque `env:` del step — nunca vía `run: echo`, `run: export`, ni command substitution inline que pueda surface-arlo en logs de CI

### Requirement: The bridge SHALL poll the AVL upstream every 30 seconds with exponential backoff on error

El bridge SHALL correr un poll loop scheduleado a un intervalo base definido por `POLL_INTERVAL_MS` (default 30 000 ms). Cada poll SHALL fetchear la URL en `ORIGIN_AVL` por HTTP con timeout de 10 s, decodear el response body como ISO-8859-1, parsear como XML, y producir un snapshot en memoria de markers.

Ante un error de poll (HTTP no-2xx, timeout, parse failure, body vacío), el bridge SHALL aplicar backoff exponencial: el próximo intento espera `30s → 60s → 120s → 240s → 300s` (cap en 300 s) antes del retry. El backoff SHALL resetear al intervalo base al primer poll exitoso.

#### Scenario: Healthy poll cadence
- **WHEN** el upstream está accesible y devuelve XML válido
- **THEN** el bridge poolea cada `POLL_INTERVAL_MS` milisegundos, y cada poll exitoso resetea cualquier backoff previo

#### Scenario: Exponential backoff under sustained errors
- **WHEN** el upstream devuelve errores en tres polls consecutivos
- **THEN** el gap entre intentos crece según la secuencia `60s, 120s, 240s` (cap en 300 s a partir de ahí) y resetea a 30 s cuando el próximo poll tiene éxito

### Requirement: The bridge SHALL expose two GTFS-Realtime endpoints satisfying the `otp-routing` URL contract

El bridge SHALL servir, sobre `http://bridge:3001`, los dos endpoints declarados en R-05 de [`otp-routing`](../../../specs/otp-routing/spec.md):

| Path | Content-Type | Payload |
|---|---|---|
| `GET /gtfs-rt/vehicle-positions.pb` | `application/x-protobuf` | Un `FeedMessage` GTFS-Realtime cuyas entities son `VehiclePosition`s por cada marker matcheado a un trip |
| `GET /gtfs-rt/trip-updates.pb` | `application/x-protobuf` | Un `FeedMessage` GTFS-Realtime cuyas entities son `TripUpdate`s con deltas `stop_time_update` (delay en segundos) para los próximos 5 stops de cada trip matcheado |

Ambas respuestas SHALL incluir un header válido con `gtfs_realtime_version: "2.0"`, `incrementality: FULL_DATASET`, y `timestamp` igual al timestamp del último poll exitoso. Ambos `FeedMessage`s SHALL ser encoded vía la lib oficial `gtfs-realtime-bindings` (sin protobuf hand-rolled).

El `feedId` de cada `FeedEntity.id` y cada referencia a `TripDescriptor.trip_id` SHALL ser consistente con `agency_id = sol-antigua` en `data/agency.txt`.

#### Scenario: Vehicle positions response is valid GTFS-RT FeedMessage with header
- **WHEN** OTP pollea `GET /gtfs-rt/vehicle-positions.pb`
- **THEN** la respuesta es `200 OK`, `Content-Type: application/x-protobuf`, y el body decodifica vía `gtfs-realtime-bindings` a un `FeedMessage` cuyo `header.gtfs_realtime_version` es `"2.0"` y `header.incrementality` es `FULL_DATASET`

#### Scenario: Trip updates carry stop_time_update deltas
- **WHEN** OTP pollea `GET /gtfs-rt/trip-updates.pb` mientras al menos un marker está matcheado a un trip
- **THEN** la respuesta contiene al menos un `FeedEntity` cuyo array `trip_update.stop_time_update[]` no está vacío, con cada entry exponiendo un delay en segundos

#### Scenario: Empty fallback when the last poll is stale
- **WHEN** han pasado más de 120 s desde el último poll exitoso
- **THEN** ambos endpoints SHALL seguir devolviendo `200 OK` con un `FeedMessage` válido cuyo array `entity` está vacío y cuyo `header.timestamp` refleja el current request time

### Requirement: The bridge SHALL match AVL markers to GTFS trips via synthetic matching, with a deterministic fallback

Para cada marker del último snapshot, el bridge SHALL derivar un `trip_id` siguiendo este algoritmo:

1. Si el identificador del operador-side del marker (`srv`) matchea exactamente un `trip_id` en `data/trips.txt`, usarlo (fast path forward-compatible).
2. Sino, determinar el `service_id` activo para la fecha actual en `America/Montevideo` desde `calendar.txt` + `calendar_dates.txt`.
3. Filtrar trips candidatos por (route_short_name == marker.lin, direction_id == marker.dir, service_id).
4. Para cada candidato, computar la distancia great-circle entre `(marker.lat, marker.lon)` y la posición interpolada desde el `stop_times.txt` de ese trip al `marker.time`.
5. Elegir el trip con la menor distancia, siempre que esa distancia sea ≤ un máximo configurable (default 200 m).
6. Si ningún candidato cae dentro del threshold, el marker SHALL ser **dropped** del `FeedMessage` emitido y SHALL incrementar el counter `unmatched` expuesto vía healthz.

Los markers dropped SHALL NOT hacer fallar los endpoints; SHALL ser loggeados a nivel `info` (una entry de log por marker unmatched por poll).

#### Scenario: Marker matches via geometric snap
- **WHEN** un marker trae `lin = 4`, `dir = 1`, `lat/lon` cerca de la trayectoria del trip `4-weekday-1-2300`
- **THEN** el `FeedMessage` emitido incluye ese marker mapeado a `trip_id = 4-weekday-1-2300`

#### Scenario: Unmatched marker is dropped, not crashed
- **WHEN** un marker trae `lin = 4` pero su posición está a más de 200 m de la trayectoria interpolada de cualquier trip candidato
- **THEN** el marker se omite del `FeedMessage` emitido, `unmatched_count` se incrementa, y el endpoint sigue respondiendo `200 OK`

### Requirement: The bridge SHALL expose `GET /healthz` with a rich JSON status

`GET /healthz` SHALL responder `200 OK` con `Content-Type: application/json` y un body conforme a este shape:

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

El campo `status` SHALL ser determinado por:

- `"ok"` cuando `feed_age_seconds <= 60` AND `miss_rate_pct (últimos 10 polls) <= 10`.
- `"degraded"` cuando `feed_age_seconds` está en `(60, 120]` OR `miss_rate_pct` está en `(10, 50]`.
- `"down"` cuando `feed_age_seconds > 120` OR `miss_rate_pct > 50`.

El `healthcheck:` de compose SHALL probar este endpoint y tratar `"ok"` y `"degraded"` como healthy desde la perspectiva de Docker (el container está vivo y respondiendo). `"down"` SHALL seguir causando que el endpoint responda — MUST NOT causar que el proceso salga.

#### Scenario: Healthz reports ok on a fresh successful poll
- **WHEN** el último poll tuvo éxito hace menos de 60 s y el miss rate reciente es 0
- **THEN** `GET /healthz` devuelve 200 con `{"status": "ok", ...}` y `feed_age_seconds <= 60`

#### Scenario: Healthz reports degraded under partial outage
- **WHEN** pasaron 90 s desde el último éxito pero el service sigue polleando
- **THEN** `GET /healthz` devuelve 200 con `{"status": "degraded", ...}` y el bridge sigue sirviendo los endpoints `.pb` (con fallback vacío si stale)

### Requirement: A CI workflow SHALL validate the bridge's GTFS-RT output against MobilityData's `gtfs-realtime-validator` using a committed AVL fixture

Un workflow `.github/workflows/bridge-rt-validate.yml` SHALL correr en push/PR que toque cualquiera de: `bridge/**`, `data/*.txt`, `docker-compose.yml`, o el workflow file. El job SHALL:

1. Checkout del repo.
2. Instalar Node (versión major matcheando `bridge/package.json` `engines.node`) y correr `npm ci` + `npm run build` dentro de `bridge/`.
3. Arrancar el bridge en *modo fixture* — setear `ORIGIN_AVL=file://./test/fixtures/avl-sample.xml`, donde `avl-sample.xml` es un sample committeado de output AVL representativo (ISO-8859-1). El fixture SHALL NOT incluir la URL real del upstream ni credenciales operator-side — solo el shape del payload de markers necesario para el matcher y el validator. Este workflow SHALL NOT referenciar `secrets.ORIGIN_AVL`.
4. Esperar a que `GET /healthz` reporte `"status": "ok"` o `"degraded"` (el fixture es un snapshot — `last_success_ts` es el timestamp del fixture, no "now"; `"degraded"` es aceptable acá).
5. Bajar `/gtfs-rt/vehicle-positions.pb` y `/gtfs-rt/trip-updates.pb`.
6. Correr el `gtfs-realtime-validator` de MobilityData contra los dos archivos `.pb` más el `gtfs.zip` estático producido por `tooling/scripts/build_gtfs_zip.py`.
7. Assertar cero errores P0 y cero P1.

El workflow SHALL salir con código non-zero si cualquier step falla, y SHALL subir los `.pb` capturados más el report del validator como artifact del workflow (`actions/upload-artifact@v4`, `if: always()`) para que los reviewers puedan inspeccionar la run, matcheando el patrón usado por `otp-smoke.yml`.

Un segundo workflow `.github/workflows/bridge.yml` SHALL correr lint + unit tests dentro de `bridge/` sobre los mismos triggers que el workflow del validator.

#### Scenario: Validator workflow runs on bridge changes
- **WHEN** un pull request modifica `bridge/src/` o `bridge/test/fixtures/avl-sample.xml`
- **THEN** el workflow `bridge-rt-validate` se dispara para ese PR

#### Scenario: Validator asserts zero P0/P1 errors
- **WHEN** el workflow corre el `gtfs-realtime-validator` contra los `.pb` fetcheados
- **THEN** el report del validator contiene cero entries con severity P0 y cero con P1; el job sale con código zero

#### Scenario: Validator artifacts are uploaded
- **WHEN** el workflow termina (success o failure)
- **THEN** un step `actions/upload-artifact@v4` subió un directorio conteniendo al menos las dos respuestas `.pb` y el report del validator

### Requirement: Bridge documentation SHALL describe the service end-to-end

Un `bridge/README.md` (español primario) y `bridge/README.en.md` (mirror en inglés, según la convención del proyecto) SHALL documentar, como mínimo:

- El stack (NestJS + `@nestjs/axios` + `fast-xml-parser` + `iconv-lite` + `gtfs-realtime-bindings`) y la versión major pineada de Node.
- Cómo correr el bridge local vía `docker compose up bridge` (con el prereq de que exista `.env`).
- Los dos endpoints `.pb`, el contrato de healthz, y cómo refrescar el GTFS estático (restart del container).
- El comportamiento esperado cuando el AVL upstream no es accesible (backoff + fallback empty-feed + healthz `"degraded"`/`"down"`).
- Un pointer al spec contract en `openspec/specs/bridge-gtfs-rt/spec.md`.

El root `README.md` (+ `README.en.md`) SHALL linkear a `bridge/README.md` desde su sección de Documentación y SHALL mostrar los badges de los workflows `bridge.yml` y `bridge-rt-validate.yml`. El `deployment/README.md` SHALL ser actualizado para que su sección "Bridge ausente — comportamiento esperado" también documente el path "bridge presente".

#### Scenario: bridge/README.md exists and is linked from the root README
- **WHEN** se inspecciona el repositorio
- **THEN** `bridge/README.md` y `bridge/README.en.md` están presentes, y el `README.md` root referencia a `bridge/README.md` desde su sección de Documentación

#### Scenario: Workflow badges are visible in the root README
- **WHEN** el `README.md` root se renderiza
- **THEN** incluye status badges para `bridge.yml` y `bridge-rt-validate.yml`
