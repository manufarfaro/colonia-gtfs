# `bridge/` — AVL → GTFS-Realtime

**Español** · [English](README.en.md)

Service interno que poolea el AVL del operador, matchea cada marker contra el feed GTFS Schedule estático y emite los dos endpoints `.pb` que OpenTripPlanner ya está esperando. Implementación del spec [`openspec/specs/bridge-gtfs-rt/spec.md`](../openspec/specs/bridge-gtfs-rt/spec.md) (post-archive del change `bridge-gtfs-rt`). Mientras tanto, el spec draft está en [`openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md`](../openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md).

[![Bridge](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge.yml)
[![Bridge RT validate](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge-rt-validate.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge-rt-validate.yml)

## Stack

- [NestJS 11](https://nestjs.com/) — framework + DI + scheduler.
- [`@nestjs/axios`](https://docs.nestjs.com/techniques/http-module) — HttpService inyectable (wrapper RxJS sobre `axios`).
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) — parser XML del AVL.
- [`iconv-lite`](https://github.com/ashtuchkin/iconv-lite) — decodificación ISO-8859-1.
- [`gtfs-realtime-bindings`](https://github.com/MobilityData/gtfs-realtime-bindings) — protobuf bindings oficiales de MobilityData.
- Node 26 (Active LTS desde 2026-10-28). Pin de imagen: `node:26.1.0-alpine3.23` (`Dockerfile`).

## Pre-requisitos

- Docker + Docker Compose v2 (el daemon corriendo).
- `data/*.txt` del repo committeados — el bridge los lee al boot vía mount read-only.
- Un `.env` en la raíz del repo con la URL del AVL real. Copiar desde `.env.example` (no committear el valor real):

```bash
cp .env.example .env
$EDITOR .env  # completar ORIGIN_AVL=...
```

## Boot local

```bash
# Desde la raíz del repo
docker compose up bridge

# O ambos services (bridge + OTP) juntos
docker compose up
```

El primer poll exitoso suele caer en ~1-5 s después del arranque. Una vez verde:

```bash
# Healthz (status, feed_age, miss_rate, vehicles tracked/unmatched)
curl http://localhost:3001/healthz   # solo accesible con override; ver más abajo

# Endpoints .pb (consumidos por OTP)
curl http://localhost:3001/gtfs-rt/vehicle-positions.pb -o vp.pb
curl http://localhost:3001/gtfs-rt/trip-updates.pb -o tu.pb
```

### Modo fixture (sin AVL real)

Para correr el bridge sin pegarle al operador real (offline, dev, demo aislado):

```bash
# En .env:
ORIGIN_AVL=file:///app/test/fixtures/avl-sample.xml
```

El poller detecta el prefijo `file://` y lee el archivo en lugar de hacer HTTP.

## Puertos y red

- El bridge escucha en `3001` **dentro** del container.
- El `docker-compose.yml` base **no** publica ese puerto al host. OTP lo alcanza vía `http://bridge:3001` por la red interna de Docker (contrato pineado por `otp-routing` R-05).
- Para debug local desde tu máquina: usar `compose.override.yml` o `compose.override.ci.yml` (el último publica `3001:3001`).

## Endpoints

| Path | Content-Type | Descripción |
|---|---|---|
| `GET /gtfs-rt/vehicle-positions.pb` | `application/x-protobuf` | `FeedMessage` GTFS-RT v2.0 con un `VehiclePosition` por marker matcheado. |
| `GET /gtfs-rt/trip-updates.pb` | `application/x-protobuf` | `FeedMessage` con `TripUpdate`s + `stop_time_update[]` de los próximos 5 stops con delay propagado. |
| `GET /healthz` | `application/json` | Status (`ok` / `degraded` / `down`), age del feed, miss rate, vehicles tracked/unmatched, backoff actual. |

## Comportamiento ante AVL caído

- Backoff exponencial: `30 → 60 → 120 → 240 → 300 s` (cap), reseteado al primer poll exitoso.
- Cuando el último poll exitoso es >120 s viejo, los endpoints `.pb` siguen respondiendo `200 OK` con un `FeedMessage` válido pero vacío (`entity: []`) — OTP loguea "no updates" y sigue rutando sobre el feed estático sin caerse.
- `/healthz` reporta `degraded` (60-120 s stale o miss rate 10-50 %) o `down` (>120 s stale o miss rate >50 %).

## Manejo de la URL como secret

La URL del AVL upstream se trata como secret en todo el stack:

- **Nunca** committeada al repo. `.env.example` solo trae el placeholder `ORIGIN_AVL=` (sin valor).
- En CI viene de `${{ secrets.ORIGIN_AVL }}` (solo workflows que necesiten la URL real; el smoke validator usa el modo `file://` y NO referencia el secret).
- El bridge no loguea la URL en ningún path: los errores HTTP (`AxiosError`) se interceptan en `PollerService` y se reemiten como errores de dominio (`HttpPollError`, `PollTimeoutError`, `PollNetworkError`) cuyo mensaje no incluye la URL.
- `/healthz` tampoco la echoea.

## Layout

```
bridge/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── eslint.config.js          ESLint v10 flat config
├── .prettierrc
├── Dockerfile                Multi-stage build (Node 26 Alpine)
├── bin/
│   └── healthcheck.js        Docker healthcheck (node-based — la imagen no trae curl)
├── src/
│   ├── main.ts               Bootstrap NestJS
│   ├── app.module.ts
│   ├── gtfs/                 Loader del GTFS estático
│   ├── matcher/              Marker → trip matching (D-05)
│   ├── poller/               Poll loop + parser + backoff (D-06)
│   ├── emitter/              FeedMessage builder (D-08/D-09)
│   ├── rt/                   GET /gtfs-rt/*.pb controllers + empty-feed fallback
│   └── healthz/              GET /healthz controller
└── test/
    └── fixtures/             gtfs-mini + avl-mini + avl-sample
```

## Tests

Implementación **test-first** per [D-11 del design del change](../openspec/changes/bridge-gtfs-rt/design.md). Cada módulo tiene su par red → green → refactor. Resumen:

```bash
cd bridge && npm test
```

37 tests cubriendo: loader (7), matcher (3), parser (4), poller (9), emitter (4), controller (4), healthz (6).

## CI

| Workflow | Trigger | Qué hace |
|---|---|---|
| [`bridge.yml`](../.github/workflows/bridge.yml) | push/PR sobre `bridge/**` | `npm ci`, `npm run lint`, `npm test`, `npm run build`. |
| [`bridge-rt-validate.yml`](../.github/workflows/bridge-rt-validate.yml) | push/PR sobre `bridge/**`, `data/*.txt`, compose, workflow file | Arranca el bridge en modo fixture (`ORIGIN_AVL=file://…`), fetchea los `.pb`, corre `gtfs-realtime-validator` de MobilityData, asserta cero errores. Sube los `.pb` + reporte como artifact. |

## Refresh del GTFS estático

El bridge carga `data/*.txt` al boot (mount read-only). Cuando se actualizan los `.txt`:

```bash
docker compose restart bridge
```

(~3 s downtime). Sin hot-reload — la decisión es deliberada (design D-04).

## Spec contract

El contrato verificable que satisface este service vive en [`openspec/specs/bridge-gtfs-rt/spec.md`](../openspec/specs/bridge-gtfs-rt/spec.md) (post-archive). Mientras tanto: [`openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md`](../openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md).
