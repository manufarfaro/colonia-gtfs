## Context

Los specs previos del stack v0 ya entregan:

- [`otp-routing`](../../specs/otp-routing/spec.md) (archivado en `archive/2026-05-19-otp-deployment`) — motor de planning sobre `data/output/gtfs.zip` + `colonia.osm.pbf`. GraphQL en `POST /otp/gtfs/v1`. Sin host port mapping (D-06).
- [`bridge-gtfs-rt`](../../specs/bridge-gtfs-rt/spec.md) (archivado en `archive/2026-05-20-bridge-gtfs-rt`) — service NestJS que poolea el AVL del operador y expone GTFS-RT en `/gtfs-rt/{vehicle-positions,trip-updates}.pb` + `/healthz` JSON. Sin host port mapping.
- [`gtfs-static-data`](../../specs/gtfs-static-data/spec.md) (archivado en `archive/2026-05-18-data-layer-gtfs-static`) — feed estático determinístico.

El BFF cierra la cadena: es el **único** service del stack con host port mapping y por lo tanto el **único** entry point público del demo. El viewer (spec siguiente) se sirve desde el BFF y le pega a sus endpoints REST.

Constraints heredados:

- Stack v0 = single-host Docker compose. Sin k8s.
- Producto = "viewer turístico estilo Google Maps Transit" (PRD §5.1). El BFF traduce el contrato GraphQL de OTP (que es general-purpose) a una superficie REST chica y opinada que solo expone lo que el viewer canónico usa.
- Demo cerrado en v0 (PRD §1) — sin auth, sin rate limiting, sin observabilidad pesada. El día que pase a público (v0.1+) se reconsidera.
- OTP 2.10 **no** expone `vehiclePositions` como top-level GraphQL field (verificado durante el smoke del bridge). Las posiciones live van por el `.pb` del bridge, no por GraphQL.

## Goals / Non-Goals

**Goals:**

- Un service `bff` arrancable con `docker compose up bff` (que a su vez tira `depends_on: otp + bridge`).
- Superficie REST chica y opinada que el viewer consume sin tener que conocer GraphQL ni protobuf: `POST /api/plan`, `GET /api/stops/:id/arrivals`, `GET /api/lines/:id`, `GET /api/lines/:id/vehicles`, `GET /api/healthz`.
- Validación de input vía `zod` — el viewer puede mandar cualquier cosa, el BFF rechaza con `400` shape consistente.
- Degradación graciosa: cuando OTP o el bridge están caídos, los endpoints respondes con `502` solo si no pueden cumplir; cuando pueden cumplir parcialmente, devuelven el subset disponible más un `meta.realtime_available: false`.
- Static serve del viewer build (path inyectado por env), de modo que el mismo container hostea backend + frontend.
- Tests unitarios sobre los traductores REST↔GraphQL, el decoder protobuf, y el caching, vía red roja → verde (TDD per `superpowers:test-driven-development`).
- Smoke CI end-to-end: levanta el stack completo, hace request real a cada endpoint, asserta sobre la shape.

**Non-Goals:**

- **NestJS.** El BFF es un proxy fino + estático server. NestJS introduciría módulos / DI / decorators sin payoff. Express + funciones explícitas es legible y testeable. (Reconsiderar si el BFF crece a >5 features.)
- **Authn/Authz.** PRD §6.4. v0 público.
- **Rate limiting.** Demo cerrado.
- **WebSocket / SSE** push de live updates. El viewer poll-ea `/api/lines/:id/vehicles` cada N segundos (decisión del viewer spec siguiente).
- **API versioning** (`/api/v1/...`). v0 single version; un día que rompamos compat agregamos un prefix.
- **OpenAPI / schema published**. Útil pero overhead. Los endpoints están documentados en `bff/README.md` y en los scenarios del spec — el viewer es el único consumer.
- **Server-side caching de datos RT.** El RT cambia cada 15-30 s; cachear lo invalidaría inmediatamente. Solo cacheamos los datos estáticos (route, stops, schedule).
- **Implementar `/api/tickets` y `/api/pois`.** Stubs `501` documentados.

## Decisions

### D-01 — Ubicación del código: `bff/` en la raíz del repo

**Decisión:** `bff/` al lado de `tooling/`, `bridge/`, y `deployment/`. Express workspace independiente con su propio `package.json`. El compose lo construye vía `Dockerfile` local.

**Por qué:**

- Misma convención top-level que `bridge/` (spec previo D-01) — cada carpeta de raíz es un service o capa.
- `Dockerfile` puede usar `COPY ./bff` directo sin gymnastics de paths, igual que el bridge.

### D-02 — Stack: Express + TypeScript + axios + zod (sin NestJS)

**Decisión:** Pin de deps runtime:

| Dep | Para qué |
|---|---|
| `express` | Web framework |
| `cors` | Middleware CORS |
| `axios` | HTTP client para llamar a OTP (GraphQL) y al bridge (`.pb`) |
| `zod` | Validación de request bodies + query params |
| `gtfs-realtime-bindings` | Decode del `.pb` del bridge |

Dev: `typescript`, `tsx` (runner para `start:dev`), `vitest` (test runner; lighter-weight que jest), `@types/express`, `@types/cors`, `eslint`, `prettier`, `supertest` para tests HTTP.

**Por qué Express y no NestJS:** el bridge se justificó con NestJS porque tiene **muchas piezas internas** (poller, scheduler, parser, matcher, emitter, healthz) que se benefician de DI + módulos. El BFF es un **proxy fino**: 5 endpoints REST que traducen request→GraphQL/`.pb`→response. NestJS agrega ceremonia (decorators, módulos, `@Inject`) sin payoff a este nivel de complejidad.

**Por qué `vitest` y no `jest`:** vitest tiene mejor DX (watch mode más rápido, ESM-first, types built-in) y los tests del BFF van a ser livianos. Jest fue la elección del bridge para alinearse con NestJS — acá no aplica.

**Por qué `zod`:** un viewer puede mandar `{from: 1, to: undefined}` y queremos un `400` shape consistente, no un crash. Zod da parsing + types en un solo lugar; alternativas como `joi` o `ajv` necesitan dos pasos.

### D-03 — Node 26, imagen `node:26-alpine` (mismo pin que el bridge)

**Decisión:** Misma imagen y `engines.node` que el bridge (per `bridge-gtfs-rt` design D-03): `node:26.1.0-alpine3.23` en el `Dockerfile`, `engines.node: "26.x"` en `package.json`. Multi-stage build.

**Por qué:** mismo runtime que el bridge — un solo Node major en producción reduce la matrix de testing. Cuando v0.1+ bumpee Node, ambos services se mueven juntos.

### D-04 — REST↔GraphQL: el BFF mantiene los queries GraphQL como strings versionados en código

**Decisión:** En `bff/src/otp/queries.ts` viven los GraphQL queries de OTP como template strings constantes. Cada endpoint REST tiene exactamente uno:

```ts
export const PLAN_QUERY = `
  query Plan($from: InputCoordinates!, $to: InputCoordinates!, $date: String!, $time: String!) {
    plan(from: $from, to: $to, date: $date, time: $time, transportModes: [{mode: TRANSIT}, {mode: WALK}]) {
      itineraries {
        duration walkDistance
        legs {
          mode duration distance startTime endTime realTime realtimeState
          route { shortName longName }
          from { name lat lon stop { gtfsId } }
          to { name lat lon stop { gtfsId } }
        }
      }
    }
  }
`;
```

El handler:
1. Parsea + valida el body con zod.
2. Inyecta los inputs en el query.
3. `axios.post(OTP_BASE_URL + '/otp/gtfs/v1', { query, variables })`.
4. Traduce la respuesta a la shape REST documentada.
5. Devuelve.

**Por qué no un GraphQL client codegen (`graphql-codegen`, `urql`):** son útiles cuando hay decenas de queries que evolucionan. Acá hay 3-4 queries pequeñas; un codegen suma una step de build y un punto de falla sin ahorrar mucho.

**Por qué template strings y no parsing del schema:** el viewer no consume GraphQL — el BFF es el único consumidor. Pinear el query como string deja la dependencia con OTP visible y greppable; si OTP 2.11 rompe alguno, lo encontramos por grep en el repo.

### D-05 — `GET /api/lines/:id/vehicles`: fetch + decode del `.pb` del bridge

**Decisión:** Este endpoint NO va por OTP. Fetcha `BRIDGE_BASE_URL + '/gtfs-rt/vehicle-positions.pb'` con axios (`responseType: 'arraybuffer'`), decodifica vía `gtfs-realtime-bindings.transit_realtime.FeedMessage.decode`, filtra los entities por `entity.vehicle.vehicle.label === 'L' + lineId` (o por `entity.vehicle.trip.routeId === lineId` — el matcher del bridge ya lo setea), y devuelve `{ vehicles: [{ id, lat, lon, bearing, speed, lastSeen }], meta: { lastSuccessTs, realtimeAvailable: boolean } }`.

**Por qué no OTP:** OTP 2.10 no expone vehicle positions como top-level GraphQL field (verificado en el smoke del bridge — `__schema.queryType.fields` no incluye `vehiclePositions` ni equivalente). Las posiciones live están en el grafo de OTP pero no son query-able directo. Yendo al `.pb` del bridge:
- Misma fuente (el bridge produce el `.pb` que OTP consume).
- Sin saltos extra (BFF → bridge directo, en vez de BFF → OTP → bridge).
- El decoder `gtfs-realtime-bindings` ya está pineado por el bridge; lo reusamos sin agregar dep nueva.

### D-06 — Caching: solo datos estáticos, TTL 60 s

**Decisión:** Cache in-memory con TTL para responses no-RT:

| Cache key | TTL | Por qué |
|---|---|---|
| `route:{lineId}` (route + shape + stops) | 60 s | Cambia solo cuando se actualiza el feed estático y se reinicia el container — 60 s es suficiente bajo el escalado del demo (1 host). |
| `stops:list` (lista completa de paradas para autocomplete) | 60 s | Idem. |
| `arrivals:{stopId}` | **no cache** | Tiene RT data; cachear lo dejaría stale. |
| `plan` (itinerarios) | **no cache** | Time-sensitive. Cada plan request es único por hora/fecha. |
| `vehicles:{lineId}` | **no cache** | Live por definición. |

Implementación: `Map<string, { value, expiresAt }>`. Sin LRU porque el universo es chico (4 líneas, 130 stops). Sin Redis porque single-host.

**Por qué 60 s y no más:** post-deploy, un reload del container podría agregar nuevos stops o cambiar shapes. 60 s es la peor tasa de stale que la operación va a tolerar. Si la página del viewer se carga y muestra una línea obsoleta por 60 s tras un deploy, el siguiente refresh la corrige.

### D-07 — Manejo de errores: degradación graciosa por endpoint

**Decisión:** Cada endpoint declara cómo se comporta ante backend down:

| Endpoint | OTP down | Bridge down |
|---|---|---|
| `POST /api/plan` | `502 Bad Gateway` con `{ error: "otp_unavailable" }`. Es el core del producto — sin OTP no hay itinerarios. | OK (no usa bridge directo; los itinerarios pueden no tener RT data, pero existen). |
| `GET /api/stops/:id/arrivals` | `502`. Sin OTP no podemos resolver horarios de un stop. | OK con `meta.realtime_available: false`. Los arrivals scheduled siguen llegando vía OTP que tiene el GTFS estático. |
| `GET /api/lines/:id` | `502` (el line schedule + shape vienen de OTP). | OK (no usa bridge). |
| `GET /api/lines/:id/vehicles` | OK (no usa OTP). | `200 OK` con `{ vehicles: [], meta: { realtime_available: false, reason: "bridge_unreachable" } }`. El viewer muestra "Live data no disponible ahora mismo" en lugar de un error. |
| `GET /api/healthz` | OK siempre — refleja el estado en el body. | OK siempre. |

**Por qué este split:** el demo *cerrado* del v0 puede sobrevivir sin RT data (el operador presenta el producto sobre el feed estático). No puede sobrevivir sin OTP (el producto entero es planificar viajes). El BFF refleja esa jerarquía.

### D-08 — CORS configurable vía env

**Decisión:** Middleware `cors()` con `origin` leído desde `BFF_CORS_ORIGINS` (lista CSV de orígenes). Cuando `BFF_CORS_ORIGINS=""` (default), el middleware **no se monta** — el BFF asume same-origin con el viewer estático.

**Por qué env-configurable:** durante development, el viewer corre en `localhost:5173` (Vite default) y el BFF en `localhost:8080`. Sin CORS no hay desarrollo posible. En prod, el viewer y el BFF comparten origin (mismo dominio `demo.algo.com`).

### D-09 — Stubs documentados para `/api/tickets` y `/api/pois`

**Decisión:** Ambos endpoints responden `501 Not Implemented` con body:

```json
{
  "error": "not_implemented",
  "message": "/api/tickets is documented as a v0 stub; implementation deferred to a future spec.",
  "spec": "openspec/specs/bff-api-and-routes/spec.md#stubs"
}
```

**Por qué documentar en lugar de no rutarlos:** un `501` con body explicativo es self-documenting. Si el viewer (o cualquier integrador) los llama por accidente, ve qué pasa. Un `404` deja al consumidor adivinando si la URL está mal o el endpoint no existe.

### D-10 — Healthz agregado del stack

**Decisión:** `GET /api/healthz` devuelve un JSON que agrega el estado del BFF + healthz consultado-on-demand del bridge:

```json
{
  "status": "ok" | "degraded" | "down",
  "bff": { "uptime_seconds": 1234, "node_version": "v26.1.0" },
  "otp": { "reachable": true, "latency_ms": 12 },
  "bridge": { "reachable": true, "latency_ms": 8, "downstream": { /* bridge's /healthz body */ } }
}
```

Reglas de `status`:
- `"ok"`: OTP reachable Y bridge `downstream.status === "ok"`.
- `"degraded"`: OTP reachable Y (bridge unreachable OR bridge `downstream.status` ∈ `degraded|down`). Plan + line schedule siguen funcionando; live vehicles puede estar vacío.
- `"down"`: OTP unreachable. El demo no puede planificar viajes.

**Por qué consultar bridge healthz on-demand:** el BFF no necesita una conexión persistente al bridge — basta con un `axios.get(BRIDGE_BASE_URL + '/healthz')` con timeout corto (1 s). Cuando alguien pega `/api/healthz`, el BFF dispara la chequeada, lo cual da info fresca sin overhead background.

### D-11 — Implementación test-first (TDD) vía `superpowers:test-driven-development`

**Decisión:** Misma disciplina que el bridge (spec previo D-11). La fase de apply ejecuta cada módulo bajo red → green → refactor. Granularidad: por handler de endpoint + por traductor REST↔GraphQL.

**Cómo:** unit tests usan `supertest` para mountear la app Express en memoria + axios mocks (vía `axios-mock-adapter` o stubs simples) para OTP/bridge. Los traductores REST↔GraphQL se testean en aislamiento: dado un GraphQL response (fixture committeado), assertar que la traducción REST es la esperada.

**Naming:** cada `it(...)` referencia el R-XX del spec que cubre.

### D-12 — CI smoke end-to-end (stack completo en modo fixture)

**Decisión:** Workflow `bff-smoke.yml`:

1. Checkout + setup-node 26.
2. Build `bff` image (`docker compose build bff`).
3. Build `gtfs.zip` (`uv run --directory tooling python scripts/build_gtfs_zip.py`).
4. `docker compose -f docker-compose.yml -f compose.override.ci.yml up -d otp bridge bff` con `ORIGIN_AVL=file://./bridge/test/fixtures/avl-sample.xml` (mismo path que el bridge smoke).
5. Poll `/api/healthz` hasta `status` ∈ `ok | degraded` (timeout 90 s).
6. Hacer requests reales a `/api/plan` (Buquebus → PdT canónico), `/api/lines/4`, `/api/lines/4/vehicles`. Assertar shape + status codes.
7. Subir el directorio `smoke-out/` con responses + `healthz.json` + `bff.log` como artifact (`if: always()`).

**Por qué probar el stack completo:** el BFF tiene valor solo en composición. Un mock-based test del BFF no verifica que la traducción REST↔GraphQL match real con OTP, ni que el decode del `.pb` corresponde a lo que el bridge realmente emite. El smoke con docker compose real es el único que cubre eso. Es lento (~3-5 min) pero es el smoke, no el suite unitario.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **OTP 2.x cambia de schema GraphQL entre versiones** | Los queries GraphQL viven en `bff/src/otp/queries.ts` como constants. Bump de OTP = el smoke falla loud porque la traducción REST tira fields undefined; los unit tests del traductor (contra fixture GraphQL response committeado) también fallan. Reparar en una sesión cuando suceda. |
| **El viewer empieza a necesitar campos que el BFF no expone** | El traductor REST en el BFF es propiedad de quien iterate el viewer. Sumar fields es trivial (string concat del query + agregar al shape de salida). No es un freezing del contrato. |
| **OTP o bridge se demoran más del timeout HTTP del viewer** | El BFF tiene timeout = 10 s a OTP, 5 s al bridge. Si OTP tarda más, se devuelve `502 gateway_timeout`. El viewer puede mostrar un spinner. Para v0 demo con feed chico OTP suele responder en <100 ms. |
| **Vector de DoS contra el BFF: alguien spamea `/api/plan` y satura OTP** | Demo cerrado — riesgo bajo. Para v0.1+ público, sumar rate limiting (`express-rate-limit`, ~5 LOC). Decisión documentada acá pero no entra en v0. |
| **El cache in-memory queda desactualizado tras un deploy del feed** | TTL 60 s + restart del container al actualizar `data/*.txt` (mismo patrón que el bridge per `bridge-gtfs-rt` design D-04). |
| **Static serve del viewer apunta a un path inexistente al boot** | Si `VIEWER_BUILD_DIR` no existe, el endpoint static responde `404`. El BFF arranca igual y los endpoints `/api/*` siguen funcionando. Documentado en healthz JSON (`viewer_dist_available: boolean`). |
| **El `.pb` del bridge a veces es empty fallback (>120 s stale)** | `GET /api/lines/:id/vehicles` devuelve `200 OK { vehicles: [], meta.realtime_available: false }` cuando el `.pb` decodea a entity[] vacío. El viewer maneja eso como "no hay buses live ahora" en lugar de spinner infinito. |

## Migration Plan

No aplica: creación inicial del service. No hay estado previo del que migrar.

Cuando se aplique:

1. Crear `bff/` con la app Express, tests, `Dockerfile`, `README.md` + `.en.md`.
2. Sumar el service `bff` al `docker-compose.yml` raíz, con `ports: "8080:8080"` y `depends_on: { otp: { condition: service_healthy }, bridge: { condition: service_healthy } }`.
3. Actualizar `.env.example` con las nuevas env vars.
4. Sumar workflows `bff.yml` (lint + tests) y `bff-smoke.yml` (stack completo).
5. Actualizar root `README.md` + `deployment/README.md` con el diagrama del stack final (3 services + viewer estático servido por el BFF).
6. **Quitar** el host port mapping de OTP en `compose.override.yml.example` (se usaba para debug pre-BFF; el BFF ahora es la única puerta).

## Open Questions

Tres preguntas que se resuelven con info del viewer spec o durante apply:

- **Path del build del viewer**: ¿`viewer/dist/`? ¿`viewer/build/`? Lo decide el spec siguiente `viewer-shell-and-i18n`. Mientras tanto, el BFF acepta `VIEWER_BUILD_DIR` como env var y sirve lo que apunte (o nada, si no existe). Default razonable: `/var/bff/viewer-dist` (mount-point que el compose siguiente settea).
- **Versionado de la API**: ¿`/api/v1/...` o `/api/...`? Decisión durante apply. Default propuesto: sin prefix de versión hasta que rompamos compat.
- **Polling frequency del viewer para `/api/lines/:id/vehicles`**: el viewer spec va a decidir (probablemente 5-10 s). El BFF acepta cualquier rate porque el `.pb` del bridge ya está cacheado por OTP/clients downstream; el cost del BFF es ~10 ms por request.
