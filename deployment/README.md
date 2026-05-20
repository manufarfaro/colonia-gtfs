# `deployment/` — Stack v0 runtime

**Español** · [English](README.en.md)

Config de infraestructura para los services del stack v0:

- **`otp`** — OpenTripPlanner 2, motor de routing sobre el feed estático.
- **`bridge`** — Service NestJS que poolea el AVL y expone GTFS-RT a OTP. Detalle en [`bridge/README.md`](../bridge/README.md).
- **`viewer`** — App Next.js (UI + API routes / BFF). Único container con puerto público. Detalle en [`viewer/README.md`](../viewer/README.md).

[![OTP Smoke](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/otp-smoke.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/otp-smoke.yml)

## Estructura

```
deployment/
└── otp/
    ├── otp-config.json      Feature flags (habilita ActuatorAPI)
    └── router-config.json   Updaters GTFS-RT (vehicle-positions, stop-time-updater)
```

El `docker-compose.yml` y el `compose.override.yml.example` viven en la **raíz del repo** (decisión [D-01](../openspec/changes/otp-deployment/design.md#d-01--ubicación-del-compose-raíz-del-repo-single-file)).

## Pre-requisitos

- Docker + Docker Compose v2 (el daemon corriendo).
- Toolchain Python sincronizado: `uv sync --directory tooling` (ver [`tooling/README.md`](../tooling/README.md)).
- `data/output/gtfs.zip` construido: el compose lo monta read-only y va a fallar al boot si no existe.

```bash
# 1. Construir el feed empacado (input de OTP)
uv run --directory tooling python scripts/build_gtfs_zip.py

# 2. Levantar OTP
docker compose up otp
```

Build time típico del grafo: **5–15 segundos** para el feed actual de Sol Antigua (130 stops, ~500 KB de OSM clipeado). Una vez que loguea `Grizzly server running` y `/otp/actuators/health` devuelve `200`, está listo para queries.

## API de routing

OTP 2.10 removió la REST `/otp/routers/default/plan`. El routing se consume vía GraphQL en `POST /otp/gtfs/v1`. Ejemplo:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"query":"query { plan(from: {lat: -34.4712, lon: -57.8520}, to: {lat: -34.4470, lon: -57.8440}, transportModes: [{mode: TRANSIT},{mode: WALK}]) { itineraries { legs { mode duration route { shortName } } } } }"}' \
  http://localhost:8080/otp/gtfs/v1
```

El BFF (spec siguiente `bff-api-and-routes`) va a proxear este endpoint hacia el viewer.

## Puertos y red

En v0 el **único service con `ports:` en el `docker-compose.yml` base es el viewer** (puerto público `${VIEWER_PORT:-8080}`). OTP y bridge solo son alcanzables vía la red interna de Docker:

| Service | Puerto interno | Expuesto al host por default | Cómo lo alcanza el cliente |
|---|---|---|---|
| `viewer` | 8080 | sí (`8080`) | navegador → `http://localhost:8080` |
| `otp` | 8080 | no | viewer → `http://otp:8080` |
| `bridge` | 3001 | no | viewer + otp → `http://bridge:3001` |

Para debug local con `curl` directo contra OTP o el bridge desde tu máquina, copiá [`compose.override.yml.example`](../compose.override.yml.example) → `compose.override.yml` y descomentá los puertos. El override real está en `.gitignore`. CI usa un archivo paralelo `compose.override.ci.yml` (commiteado) que los workflows invocan explícito con `-f`.

## JVM heap

Default: `-Xmx1g -Xms512m` (decisión [D-05](../openspec/changes/otp-deployment/design.md#d-05--jvm-heap-fijo-en--xmx1g)). Si necesitás bajar/subir, override vía `compose.override.yml`:

```yaml
services:
  otp:
    environment:
      JAVA_TOOL_OPTIONS: "-Xmx2g -Xms512m"
```

## Realtime (bridge)

El service `bridge` poolea el AVL del operador, matchea markers contra el GTFS estático, y expone los dos endpoints `.pb` que OTP poolea cada 15/30 s.

- **Service runtime:** ver [`bridge/README.md`](../bridge/README.md) — stack NestJS, contrato de endpoints, healthz JSON rico, manejo del secret `ORIGIN_AVL`.
- **Spec contract:** [`openspec/specs/bridge-gtfs-rt/spec.md`](../openspec/specs/bridge-gtfs-rt/spec.md) (post-archive del change).
- **Boot:** `docker compose up bridge otp` (o solo `docker compose up` para todo). El bridge resuelve `ORIGIN_AVL` desde `.env` (gitignored).
- **Smoke offline:** `ORIGIN_AVL=file:///app/test/fixtures/avl-sample.xml` permite correr el stack sin pegarle al operador real — usado por el workflow `bridge-rt-validate.yml`.

OTP arranca y rutea sobre el feed estático con o sin bridge corriendo (R-05 scenario 3 de `otp-routing`). Si querés desmontarlo para probar el path stale, ver la sub-sección siguiente.

## Bridge ausente — comportamiento esperado

El `router-config.json` declara dos updaters GTFS-RT que apuntan al service `bridge` (puerto 3001):

| Updater | URL | Frecuencia |
|---|---|---|
| `vehicle-positions` | `http://bridge:3001/gtfs-rt/vehicle-positions.pb` | 15s |
| `stop-time-updater` | `http://bridge:3001/gtfs-rt/trip-updates.pb` | 30s |

El service `bridge` lo implementa el [spec siguiente `bridge-gtfs-rt`](../openspec/changes/) — todavía no existe. Mientras tanto:

- OTP arranca y construye el grafo OK.
- Loguea errores de conexión a `bridge:3001` cada 15/30 segundos (esperado).
- `/otp/actuators/health` sigue respondiendo `200`.
- Las queries a `/otp/routers/default/plan` funcionan sobre el feed **estático** (sin posiciones en tiempo real ni delays).

Esto es deliberado (decisión [D-07](../openspec/changes/otp-deployment/design.md#d-07--gtfs-rt-updaters-contrato-para-el-bridge)): el contrato de URLs queda fijado por este spec y el spec del bridge lo va a respetar.

## Healthcheck

Compose declara:

```yaml
healthcheck:
  test:
    - CMD
    - bash
    - -c
    - "exec 3<>/dev/tcp/localhost/8080 && printf 'GET /otp/actuators/health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -1 <&3 | grep -q ' 200 '"
  start_period: 60s
  interval: 10s
  timeout: 5s
  retries: 6
```

¿Por qué no `curl`? La imagen `opentripplanner/opentripplanner:2.10.*` (Ubuntu 26.04 minimal) no incluye `curl` ni `wget` ni `nc`. Para no introducir un Dockerfile custom (decisión [D-03](../openspec/changes/otp-deployment/design.md#d-03--imagen-upstream-sin-custom-dockerfile)) usamos un one-liner de `bash` con `/dev/tcp`, que sí está disponible. El contrato del spec solo exige probar `/otp/actuators/health` y aceptar `200` — no un binario en particular.

OTP 2.10 trae el feature `ActuatorAPI` habilitado por default — no hace falta nada en `router-config.json` para exponer `/otp/actuators/health`.

## Versión pin

La imagen está pineada al tag exacto en `docker-compose.yml`:

```
opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42
```

Bumps suceden vía PR explícito que cambia el tag + corre `otp-smoke.yml` (decisión [D-10](../openspec/changes/otp-deployment/design.md#d-10--versión-pin-con-bump-explícito)). No se usa `:latest`.

## Build-config / Otp-config

- **`otp-config.json`**: presente, habilita el feature `ActuatorAPI` (off por default en OTP 2.10) — necesario para que exista `/otp/actuators/health`.
- **`build-config.json`**: no necesario. OTP 2.10 auto-detecta los inputs:
  - `*.zip` en `/var/opentripplanner/` → feed GTFS (`gtfs.zip`).
  - `*.osm.pbf` en `/var/opentripplanner/` → grafo OSM (`colonia.osm.pbf`).

Si en algún momento hace falta tunear el build (ej. `subwayAccessTime`, `osmTagMapping` custom), agregar `deployment/otp/build-config.json` y mountarlo al mismo path.

## CI

El workflow [`otp-smoke.yml`](../.github/workflows/otp-smoke.yml) arranca el container en cada PR que toca:

- `deployment/otp/**`
- `docker-compose.yml`
- `data/*.txt`, `data/colonia.osm.pbf`
- `tooling/scripts/build_gtfs_zip.py`, `tooling/pyproject.toml`, `tooling/uv.lock`

Pasos: build `gtfs.zip` → `docker compose up otp` → wait healthz → query `/plan` (un trip-plan real de Colonia urbano) → verificar al menos un itinerary → tear down. Es el equivalente del MobilityData Canonical Validator pero para el motor de planning (decisión [D-08](../openspec/changes/otp-deployment/design.md#d-08--healthz-endpoint--ci-smoke-test)).

## Spec

El contrato verificable que satisface este deployment vive en [`openspec/specs/otp-routing/spec.md`](../openspec/specs/otp-routing/spec.md) (post-archive del change `otp-deployment`). Mientras tanto, el spec draft está en [`openspec/changes/otp-deployment/specs/otp-routing/spec.md`](../openspec/changes/otp-deployment/specs/otp-routing/spec.md).
