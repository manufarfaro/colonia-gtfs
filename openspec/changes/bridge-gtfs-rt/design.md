## Context

[Spec previo](../../specs/otp-routing/spec.md) (capability `otp-routing`, archivada en `archive/2026-05-19-otp-deployment`) declara en R-05 el contrato que el bridge tiene que cumplir:

- Dos endpoints HTTP `GET` que devuelven `application/x-protobuf`: `/gtfs-rt/vehicle-positions.pb` (poll cada 15 s desde OTP) y `/gtfs-rt/trip-updates.pb` (poll cada 30 s).
- `feedId: "sol-antigua"` (coincide con `agency_id` de `data/agency.txt`).
- Tolerar bridge ausente desde el lado de OTP — pero ahora estamos del lado contrario: tolerar AVL ausente desde el lado del bridge.

Constraints heredados del PRD ([`docs/prd/mvp-v0.md`](../../../docs/prd/mvp-v0.md)):

- Stack v0 = single-host Docker Compose. Sin k8s, sin multi-host. (PRD §6.1)
- Bridge solo en red interna de Docker — el BFF no lo proxea (OTP es el único consumidor). (PRD §6.4)
- AVL upstream: URL del operador, **no committeada al repo**. Se inyecta vía variable de entorno `ORIGIN_AVL` (local: `.env` gitignored; CI: GitHub Secret homónimo). XML codificado en ISO-8859-1. El contrato de acceso lo gestiona el owner del proyecto fuera de este repo; ver riesgo §9 del PRD para las condiciones operativas.
- Realtime cubre **demo-ready cerrado**, no SLO público. Aceptable que el feed quede unas decenas de segundos atrasado en caso de degradación de AVL. (PRD §1, §9)
- Persistencia histórica en Postgres "soportada pero off por default vía env" — explícitamente *no entra* en este v0, ni siquiera como code path (PRD §4). Se introduce, si se decide, en un change posterior.

Inputs disponibles para el matching:

- Feed estático: `data/agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`, `shapes.txt` — committeado por la capability `gtfs-static-data`.
- Convención de `trip_id` ya establecida por el data layer: `<route_short_name>-<service_id>-<direction>-<HHMM>` (ej. `4-weekday-1-2300`, `3-weekday-0-0730`). Eso permite hacer matching sintético sin acoplar el bridge al `srv` propietario del operador.

## Goals / Non-Goals

**Goals:**

- Service `bridge` arrancable con un solo `docker compose up` (sumar como sibling de `otp`).
- Polling del AVL upstream cada 30 s con resiliencia: backoff exponencial, fallback a `FeedMessage` vacío con header válido cuando no hay datos frescos.
- Emisión de GTFS-Realtime v2.0 válido — el smoke test contra MobilityData `gtfs-realtime-validator` SHALL pasar sin errores P0/P1 (criterio de aceptación 13 del PRD).
- Matching marker → trip determinístico, con fallback explícito si falla.
- Healthz que expone más que "alive": expone *cuán fresco está el feed* (last poll success, miss rate de últimos N polls, vehicles tracked).
- Tests unitarios sobre el parser XML, el matcher, y el emitter (los tres puntos de fallo más probables).
- Smoke CI sin red: fixture XML AVL committeado en `bridge/test/fixtures/avl-sample.xml` → bridge corriendo → endpoints `.pb` → validator MobilityData.

**Non-Goals:**

- Persistencia de markers (Postgres). Diferido a un change futuro.
- `occupancy_status`. Sin fuente live (D11 del relevamiento firme).
- Service alerts. Sin fuente formal en Sol Antigua (PRD §4).
- Autenticación / autorización. Service interno, OTP es el único consumidor.
- Multi-operador. El bridge es Sol Antigua-only en v0 (`feedId: "sol-antigua"` hard-coded).
- Replay / backfill. Si el bridge se cae 10 minutos, el feed muestra "stale" en healthz y reanuda; no rehidratamos historia.
- Compatibilidad con la legacy REST API de OTP (REST quedó deprecada en 2.10; el spec `otp-routing` ya usa GraphQL exclusivamente). El bridge no expone REST.

## Decisions

### D-01 — Ubicación del código: `bridge/` en la raíz del repo

**Decisión:** Subdirectorio `bridge/` al lado de `tooling/` y `deployment/`. NestJS workspace independiente con su propio `package.json`, `tsconfig.json`, `node_modules`. El compose lo construye desde ahí vía `Dockerfile` local.

**Por qué:**

- Misma convención que `tooling/` (Python project) y `deployment/` (infra config) — el repo queda con carpetas top-level que cada una representa un service o capa.
- NestJS funciona mejor como workspace con sus propios `node_modules` que como sub-package de un monorepo (que tampoco existe en este repo).
- El `Dockerfile` puede usar `COPY ./bridge` directo sin gymnastics de paths.

**Alternativa descartada:** `services/bridge/` para anticipar más services. No necesario — `bff/` y `viewer/` van a sumarse en su propio top-level cuando lleguen (mismo patrón).

### D-02 — Stack: NestJS + `@nestjs/axios` + fast-xml-parser + iconv-lite + gtfs-realtime-bindings

**Decisión:** Las dependencias runtime las pineamos en `bridge/package.json` con versiones exactas, siguiendo el stack canónico del PRD §6.1:

| Dep | Para qué |
|---|---|
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/schedule` | Framework + scheduler para el poller |
| `@nestjs/axios` (+ `axios` como peer) | `HttpService` inyectable para el poll del AVL upstream. El módulo HTTP estándar de NestJS — wrapper RxJS sobre `axios` |
| `fast-xml-parser` | Parser XML (más rápido y deterministic que `xml2js`) |
| `iconv-lite` | Decodificación de ISO-8859-1 (Node nativo no soporta encodings no-utf8 sin esta lib) |
| `gtfs-realtime-bindings` | Protobuf bindings oficiales de MobilityData |

**Por qué NestJS:** módulos + DI ya resuelven la estructura del service (PollerModule, MatcherModule, EmitterModule, HealthzModule). Express bajo el capot, así que no agregamos infra que el BFF no vaya a necesitar también después.

**Por qué `@nestjs/axios` y no `fetch` nativo:** Node 22+ trae `fetch` global y estable, así que técnicamente alcanza para un GET con timeout y body binario. Pero el módulo HTTP estándar de NestJS es `@nestjs/axios` — `HttpService`, `HttpModule`, integración con DI, interceptors a nivel framework, configuración global vía `HttpModule.register({ timeout, maxRedirects })`, y testing via `HttpService.axiosRef` mockeable. Apartarse de ese idiom no compra nada concreto para este v0 (la "dep menos" es marginal: `axios` está en ~700k npm deps y NestJS ya lo trae como peer en buena parte de su ecosistema) y deja el bridge fuera del patrón estándar que el BFF va a usar después también. Se queda axios.

**Por qué `fast-xml-parser` y no `xml2js`:** `fast-xml-parser` no recursa de forma exponencial en XML mal-formados (DoS resistance trivial en lugar de hand-rolled), es ~3-5x más rápido, y devuelve objetos planos en vez de wrappers.

### D-03 — Node 26, imagen `node:26-alpine`

**Decisión:** Pinear Node 26 (`node:26-alpine` en el `Dockerfile`, `engines.node: "26.x"` en `package.json`). Multi-stage build: `node:26-alpine AS build` con `npm ci` + `npm run build`, luego `node:26-alpine` para runtime con solo `dist/` y `node_modules` de producción.

**Por qué:**

- Node 26 salió 2026-05-05 (status `Current` al cierre de este spec). Pasa a Active LTS el 2026-10-28; maintenance hasta 2027-10-20; EOL 2029-04-30. Su ventana de soporte cubre holgado todo v0 + v0.1, más que cualquier LTS previa que esté hoy activa.
- Para el window 2026-05 → 2026-10, Node 26 está en `Current` (no LTS aún). Trade-off aceptable para demo-ready cerrado: el binario es production-ready (V8 estable, OpenSSL pineado) y al volverse LTS en octubre no hay que bump-ear nada. Si algún dep de NestJS o `gtfs-realtime-bindings` no soporta 26 todavía, el smoke de CI lo detecta loud.
- Alpine reduce la imagen a ~70 MB vs 250 MB de `node:26-slim`. `iconv-lite` es JavaScript puro — no rompe.
- Multi-stage permite que la imagen final no traiga toolchain de build.

**Pin exacto:** se elige al apply (al cierre de este spec: `node:26.1.0-alpine3.23`), recordado en el commit del apply (misma filosofía que el pin de la imagen de OTP, decisión [D-03](#) del [`otp-routing`](../../specs/otp-routing/spec.md) archivado).

**Fallback documentado:** si algún dep crítico no soporta 26 antes del apply, retroceder a `node:24-alpine` (Active LTS desde 2025-10, EOL 2028-04-30) sin cambiar la spec — el contrato del spec solo exige "Node moderno con stage build"; el major es elección del design.

### D-04 — Carga del feed estático en memoria al boot, parseando los `.txt` directos

**Decisión:** En el boot del service, leer `data/*.txt` del filesystem (mounteado read-only desde el host por el compose) y materializar índices en memoria:

```ts
{
  routes: Map<route_short_name, Route>,
  trips: Map<trip_id, Trip>,
  tripsByRouteAndDirection: Map<`${route_short_name}-${direction_id}`, Trip[]>,
  stopTimesByTrip: Map<trip_id, StopTime[]>,
  stops: Map<stop_id, Stop>,
  calendar: Map<service_id, CalendarEntry>,
  calendarDates: Map<`${service_id}-${YYYYMMDD}`, ExceptionType>,
}
```

Mount en el compose:

```yaml
bridge:
  volumes:
    - ./data:/var/bridge/gtfs:ro
```

No usamos `gtfs.zip` (lo arma el toolchain para OTP) — el bridge consume los `.txt` directo porque (a) ya está montado en el container y (b) evita una dep extra de unzip en Node.

**Por qué en memoria:** 130 stops + ~120 trips + ~3000 stop_times — bien debajo de 5 MB en RAM. Lookups O(1)/O(log n). Sin invalidation: el container se reinicia cuando cambian los `.txt`.

**Refresh:** **no** se implementa hot-reload. Cuando se actualizan los `.txt` y se quiere refrescar el bridge, `docker compose restart bridge` (~3 s downtime). Documentado en `bridge/README.md`.

### D-05 — Matching marker → trip: synthetic primero, `srv` como fallback

**Resuelve Q1 del PRD §10.1.**

**Decisión:** El algoritmo de matching prioriza el match sintético basado en la convención de `trip_id` que ya estableció `gtfs-static-data` (`<route>-<service>-<direction>-<HHMM>`):

```
input: marker { lin, dir, lat, lon, time, speed, head, id, srv? }
output: trip_id | null

1. Si marker.srv coincide con algún trip_id directo (caso forward-compatible cuando el operador alinee ids con nuestro feed): return srv.
2. Sino:
   a. Resolver service_id del día actual:
      - Leer fecha local (America/Montevideo) → día de la semana
      - Buscar en calendar.txt + calendar_dates.txt el service_id activo (weekday|saturday|sunday|holiday)
   b. Filtrar trips por (route_short_name == marker.lin, direction_id == marker.dir, service_id)
   c. Para cada trip candidato, calcular distancia entre marker.{lat,lon} y la posición esperada en marker.time
      (interpolando entre stop_times consecutivos).
   d. Elegir el trip con menor distancia, si <= MAX_SNAP_METERS (200 m por default).
   e. Sino, return null y loguear el marker como unmatched.
```

**Por qué sintético primero:**

- Nuestro feed estático ya usa la convención sintética. No estamos atados a que el operador comparta su `srv` con nosotros.
- El operador puede cambiar su scheme interno sin romper el bridge — solo importan los campos observables (`lin`, `dir`, `lat`, `lon`, `time`).
- Mantenemos el path directo `srv → trip_id` como fast-path **forward-compatible** si en el futuro coordinamos ids con Sol Antigua.

**Por qué snap por distancia:** el AVL no envía qué trip está cumpliendo el bus — solo dónde está. La heurística geométrica es la única señal confiable que tenemos. 200 m es la tolerancia natural en zona urbana de Colonia (paradas separadas ~150-300 m).

**Markers que no matchean:** se loguean con `level=info` y se omiten del `FeedMessage`. No se cae el feed.

### D-06 — Poll loop: 30 s base, backoff exponencial en error

**Decisión:** El `PollerService` ejecuta sobre el scheduler de NestJS (`@nestjs/schedule`):

- Intervalo base **30 s** entre polls exitosos (alineado con el observado upstream).
- En error (HTTP no-200, timeout >10 s, parse failure, body vacío), entrar en backoff exponencial: 30 s → 60 s → 120 s → 240 s → 300 s (cap). Resetear el delay a 30 s en el primer éxito.
- Cada poll graba: `timestamp`, `success`, `latency_ms`, `markers_count`, `matched_count`, `unmatched_count`, `http_status`. Ring buffer de los últimos 50 polls en memoria para alimentar `healthz`.

**Por qué exp backoff:** previene martillar al upstream si está caído; las cuatro retentativas iniciales (30→300 s) cubren ~12 minutos antes de saturarse, suficiente para que un blip transitorio se recupere sin alerts.

**Por qué cap a 300 s:** mantener el feed "vagamente fresco" durante una outage extendida. Vale la pena un poll cada 5 minutos incluso si los anteriores N fallaron, para volver al estado verde en cuanto el upstream regrese.

### D-07 — Empty-feed fallback con header válido

**Decisión:** Cuando el último poll falló o no hay markers fresh (>120 s desde el último poll exitoso), los endpoints siguen respondiendo `200 OK` con un `FeedMessage` válido pero **vacío**:

```protobuf
FeedMessage {
  header {
    gtfs_realtime_version: "2.0"
    incrementality: FULL_DATASET
    timestamp: <now>
  }
  entity: []   // vacío
}
```

**Por qué:** la spec de GTFS-RT exige header válido; OTP loguea el feed vacío como "no updates" y sigue rutando sobre el feed estático sin caerse. Si en cambio devolvemos `503` o no respondemos, OTP loguea un error de updater y el grafo queda con realtime stale (peor experiencia).

**Por qué 120 s como threshold de "stale":** 4x el intervalo de poll. Da una ventana de 4 polls fallidos antes de empezar a vaciar el feed; suficiente para no flickear ante un blip.

### D-08 — TripUpdates: delay calculado contra `stop_times.txt`

**Decisión:** Para cada vehículo con un `trip_id` matcheado, emitir una `TripUpdate` con:

- `trip.trip_id = <matched>`, `trip.route_id`, `trip.start_date` (YYYYMMDD local), `trip.schedule_relationship = SCHEDULED`.
- `vehicle.id = <marker.id>`.
- `stop_time_update[]`: para los próximos 5 stops del trip (desde el next-stop estimado), con:
  - `stop_id`, `stop_sequence`.
  - `arrival.delay` y `departure.delay` en segundos (positivo = atraso).
  - `schedule_relationship = SCHEDULED`.

**Cómo se calcula el delay:** comparamos el `marker.time` (timestamp del AVL en el momento que el bus pasó por el último stop conocido) con el `arrival_time` programado de ese stop en `stop_times.txt`. Propagamos ese delay constante a los próximos 5 stops (asunción: el bus no recupera ni pierde tiempo entre stops cercanos; razonable para 5 stops, ~5-10 minutos hacia adelante).

**Por qué propagación constante:** modelos más sofisticados (decay del delay, ML) son overkill para v0 con un feed denso de stops cada ~150-300 m. Si más adelante el viewer muestra ETAs que se ven raros, esto se itera.

### D-09 — VehiclePositions: campos mínimos del v2.0

**Decisión:** Para cada vehículo con `trip_id` matcheado, emitir una `VehiclePosition` con:

- `trip.trip_id` (igual a TripUpdates).
- `vehicle.id = <marker.id>`, `vehicle.label = "L${marker.lin}"`.
- `position.latitude`, `position.longitude`, `position.bearing` (de `marker.head`), `position.speed` (en m/s; AVL típicamente envía km/h, convertimos).
- `current_status = IN_TRANSIT_TO`.
- `current_stop_sequence` = la próxima parada.
- `stop_id` (la siguiente parada según el matching).
- `timestamp = marker.time`.

**Skip:** vehículos sin `trip_id` matcheado **no** se emiten (no podemos atribuirlos a un trip; OTP no puede consumirlos útilmente). Sí se cuentan en el healthz como `unmatched_count`.

### D-10 — Healthz: rich JSON, no bool

**Decisión:** `GET /healthz` responde JSON estructurado (no solo `{"status": "UP"}`):

```json
{
  "status": "ok" | "degraded" | "down",
  "last_poll_ts": "2026-05-20T13:45:30Z",
  "last_success_ts": "2026-05-20T13:45:30Z",
  "feed_age_seconds": 0,
  "miss_rate_pct": 0.0,
  "vehicles_tracked": 12,
  "vehicles_unmatched": 2,
  "current_backoff_seconds": 30
}
```

Reglas de `status`:

- `"ok"`: último poll exitoso, `feed_age_seconds <= 60`, `miss_rate_pct (últimos 10 polls) <= 10`.
- `"degraded"`: feed_age 60–120 s **o** miss_rate 10–50 %. El service responde, pero el feed está stale.
- `"down"`: feed_age > 120 s **o** miss_rate > 50 %. Endpoints siguen respondiendo `FeedMessage` vacío con header.

**Por qué rich:** el healthz no es solo para Docker — el operador del demo lo va a curl-ear cuando reciba un report "los buses no se ven en el mapa". Que la respuesta sea diagnóstica directamente.

**Compose healthcheck:** el `docker-compose.yml` declara `healthcheck:` que matchea por `"status":"ok"` o `"degraded"` como healthy. `"down"` también queda como healthy para Docker (porque el container está vivo y respondiendo), pero el log lo va a delatar.

### D-11 — Implementación test-first (TDD) vía el skill `/test-driven-development`

**Decisión:** La fase de apply de este change se ejecuta siguiendo el skill `superpowers:test-driven-development`. Para cada módulo del bridge (PollerService, AvlParser, MatcherService, EmitterService, RtController, HealthzController, GtfsStaticService) la secuencia es:

1. **Red** — escribir el test que describe el comportamiento esperado y verlo fallar con un error concreto (no un import error: un assertion failure).
2. **Green** — implementar lo mínimo para que el test pase. Sin generalizaciones tempranas.
3. **Refactor** — limpiar duplicación / nombres / tipos sin cambiar el comportamiento, con la suite verde como red de seguridad.

El `tasks.md` está ordenado para reflejar este flow: cada par "escribir tests de X" / "implementar X" lista el test primero (por ejemplo, 2.1 son los tests del loader, 2.2 es la implementación que los hace pasar).

**Por qué TDD para este service:**

- Mismo precedente que el toolchain Python en `tooling/` — el `tooling/README.md` ya documenta que "Each Python script has tests written first (red), then the minimal implementation (green)". El bridge se alinea con esa disciplina.
- El bridge tiene varias piezas independientes con failure modes distintos (parsing ISO-8859-1, snap geométrico al GTFS, codificación protobuf, scheduler con backoff). Sin TDD, un bug en cualquiera queda invisible hasta que el smoke de CI lo destape — y el smoke es un test integrado, no aísla qué módulo falló.
- El fixture committeado (`bridge/test/fixtures/avl-sample.xml`) tiene doble función: input determinístico para los unit tests **y** input del smoke `bridge-rt-validate.yml` (D-12 siguiente). TDD nos asegura que cada módulo individual ya pasa contra ese fixture antes de que se ensamble el integration.

**Cómo se nombran los tests:** cuando un test cubre un scenario del spec (R-XX), nombrar el `it(...)` con referencia al requirement, para que el reporte de Jest mapee directo al contrato:

```ts
describe('HealthzController', () => {
  it('R-07: reports "degraded" after 90 s of stale feed', async () => { /* ... */ });
});
```

**Qué NO entra bajo TDD:**

- Tasks de scaffolding (grupo 1) — crear el `package.json`, `Dockerfile`, `.env.example` no tiene comportamiento testeable.
- Edits del `docker-compose.yml` y de los workflows de CI (grupos 4 y 5) — son configuración declarativa; su "test" es el smoke workflow corriendo verde.
- Documentación (grupo 6).

### D-12 — CI smoke con `gtfs-realtime-validator` contra fixture offline

**Decisión:** Sumar `.github/workflows/bridge-rt-validate.yml` que:

1. Checkout.
2. Setup Node 22 + npm install en `bridge/`.
3. Build (`npm run build`).
4. Levantar el bridge en modo *fixture* — variable de entorno `ORIGIN_AVL=file://./test/fixtures/avl-sample.xml` (en lugar del upstream real).
5. `curl http://localhost:3001/gtfs-rt/vehicle-positions.pb -o vp.pb` y `curl http://localhost:3001/gtfs-rt/trip-updates.pb -o tu.pb`.
6. Correr `gtfs-realtime-validator` (action de MobilityData) contra los dos `.pb` + el `gtfs.zip` del data layer.
7. Asserta cero errores P0/P1.

**Por qué fixture offline:** el AVL upstream no tiene SLA — no podemos depender de él para CI verde. Capturamos un sample real una vez (con el script externo de captura), lo committeamos como `bridge/test/fixtures/avl-sample.xml`, y el bridge tiene un modo `file://` que lee de disco en lugar del HTTP.

**Por qué un workflow separado del `bridge.yml`:** `bridge.yml` corre rápido (lint + tests, segundos). `bridge-rt-validate.yml` requiere boot del service + validator de Java → un par de minutos. Tenerlos separados facilita iterar tests sin esperar al validator y viceversa.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **AVL Sol Antigua cae intermitentemente o cambia su esquema XML** (PRD §9) | Backoff exponencial (D-06) + empty-feed fallback (D-07). `healthz` expone miss rate (D-10). Si cambia schema, el unit test del parser falla loud en CI; el operador del demo ve `"down"` en healthz. |
| **Marker → trip matching da falsos positivos cuando dos trips se superponen geográficamente** | Tolerancia de 200 m + dirección (`direction_id`) reducen colisiones. Si aparecen en producción, se itera bajando el threshold o sumando una desambiguación por scheduled departure time. Los unmatched count exposed en healthz. |
| **L5 con poca data → matching errático** (PRD §9) | El bridge no distingue líneas — si L5 da poco match, el viewer va a mostrar pocos buses live en su line schedule. Disclaimer específico de L5 ya está en el plan del PRD. No infla el spec de bridge. |
| **Race condition entre rebuild del trip-update feed y el GET del endpoint** | Generar el `FeedMessage` lazily al GET sobre el snapshot atómico del último poll exitoso (`const snapshot = this.latest`). Single-pass, sin locks (NestJS sirve sobre Node single-threaded). |
| **iconv-lite no decodea correctamente caracteres especiales del XML** (ej. acentuados en stop names de la respuesta) | Test unitario sobre el fixture cubre nombres con acentos. `gtfs-realtime-validator` valida el `.pb` resultante full-utf8. |
| **Clock skew entre runner y AVL** | El AVL envía un timestamp en cada marker; lo usamos directamente para `position.timestamp` y para calcular delay (no usamos `Date.now()` del bridge para eso). |
| **`gtfs-realtime-bindings` queda desactualizado contra el schema upstream** | Pin de versión explícito en `package.json`. Bumps vía PR + el smoke `bridge-rt-validate.yml` corre el validator de MobilityData — si el schema upstream cambia algo material, lo detecta. |
| **`ORIGIN_AVL` se filtra a logs o errores HTTP** | Tratar `ORIGIN_AVL` como secret: cargar de env, no loguearlo nunca. Los `AxiosError` (que por default incluyen `config.url` en su payload) se interceptan en el `PollerService` y se reemiten como errores de dominio (`HttpPollError`, `PollTimeoutError`, etc.) que **no incluyen la URL en su mensaje** antes de llegar a cualquier log appender. El `.env.example` documenta el placeholder; `.env` queda gitignored. |

## Migration Plan

No aplica: creación inicial del service. No hay estado previo del que migrar.

Cuando se aplique este change:

1. Crear `bridge/` con la app NestJS, tests, `Dockerfile`, `README.md`.
2. Sumar el service `bridge` al `docker-compose.yml` raíz, con mount de `./data:/var/bridge/gtfs:ro` y `env_file: .env`.
3. Crear `.env.example` y agregar `.env` al `.gitignore`.
4. Sumar workflows `bridge.yml` (lint + tests) y `bridge-rt-validate.yml` (validator MobilityData).
5. Actualizar `deployment/README.md` para reflejar que el realtime ya no es "bridge ausente" sino "bridge presente, healthz expuesto".
6. Actualizar root `README.md` con el badge del workflow y el link al `bridge/README.md`.

## Open Questions

Quedan dos preguntas operativas que se resuelven con muestreo real cuando el bridge esté corriendo, no antes del spec:

- **¿La spec de markers AVL incluye un campo `srv` consistente con nuestro `trip_id` sintético?** D-05 asume que no y prioriza el matching geométrico; el fast-path `srv → trip_id` queda como forward-compatibility. Se valida con el fixture committeado.
- **¿Algún umbral de miss-rate sobre el cual el demo del v0 ya no es presentable?** D-10 define `"down"` a >50 %, suficiente para que healthz lo refleje. La decisión de cancelar un demo en función de eso es operativa, no de spec.

Una pregunta queda **fuera** del scope de este change y va al spec siguiente:

- ¿`bff-api-and-routes` polea `/healthz` del bridge para exponerlo al viewer ("buses live no disponibles ahora mismo"), o el viewer es agnóstico al estado del realtime y el operador del demo lo monitorea aparte?
