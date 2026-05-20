# `bridge/` — AVL → GTFS-Realtime

[Español](README.md) · **English**

Internal service that polls the operator's AVL, matches each marker against the static GTFS Schedule feed, and emits the two `.pb` endpoints OpenTripPlanner already expects. Implements the spec at [`openspec/specs/bridge-gtfs-rt/spec.md`](../openspec/specs/bridge-gtfs-rt/spec.md) (post-archive of the `bridge-gtfs-rt` change). Until then: [`openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md`](../openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md).

[![Bridge](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge.yml)
[![Bridge RT validate](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge-rt-validate.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge-rt-validate.yml)

## Stack

- [NestJS 11](https://nestjs.com/) — framework + DI + scheduler.
- [`@nestjs/axios`](https://docs.nestjs.com/techniques/http-module) — injectable HttpService (RxJS wrapper around `axios`).
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) — AVL XML parser.
- [`iconv-lite`](https://github.com/ashtuchkin/iconv-lite) — ISO-8859-1 decoding.
- [`gtfs-realtime-bindings`](https://github.com/MobilityData/gtfs-realtime-bindings) — official MobilityData protobuf bindings.
- Node 26 (Active LTS from 2026-10-28). Image pin: `node:26.1.0-alpine3.23` (`Dockerfile`).

## Prerequisites

- Docker + Docker Compose v2 (daemon running).
- `data/*.txt` from the repo (committed) — the bridge reads them at boot via a read-only mount.
- A `.env` at the repo root with the real AVL URL. Copy from `.env.example` (never commit the real value):

```bash
cp .env.example .env
$EDITOR .env  # fill ORIGIN_AVL=...
```

## Local boot

```bash
# From the repo root
docker compose up bridge

# Or both services together (bridge + OTP)
docker compose up
```

First successful poll usually lands within ~1-5 s of startup. Once green:

```bash
# Healthz (status, feed_age, miss_rate, vehicles tracked/unmatched)
curl http://localhost:3001/healthz   # only reachable from the host via an override; see below

# .pb endpoints (consumed by OTP)
curl http://localhost:3001/gtfs-rt/vehicle-positions.pb -o vp.pb
curl http://localhost:3001/gtfs-rt/trip-updates.pb -o tu.pb
```

### Fixture mode (no real AVL)

To run the bridge without hitting the operator (offline, dev, isolated demo):

```bash
# In .env:
ORIGIN_AVL=file:///app/test/fixtures/avl-sample.xml
```

The poller detects the `file://` prefix and reads from disk instead of HTTP.

## Ports and network

- The bridge listens on `3001` **inside** the container.
- The base `docker-compose.yml` does **not** publish that port to the host. OTP reaches it via `http://bridge:3001` over Docker's internal network (the URL contract pinned by `otp-routing` R-05).
- For local debug from your machine: use `compose.override.yml` or `compose.override.ci.yml` (the latter publishes `3001:3001`).

## Endpoints

| Path | Content-Type | Description |
|---|---|---|
| `GET /gtfs-rt/vehicle-positions.pb` | `application/x-protobuf` | GTFS-RT v2.0 `FeedMessage` with one `VehiclePosition` per matched marker. |
| `GET /gtfs-rt/trip-updates.pb` | `application/x-protobuf` | `FeedMessage` with `TripUpdate`s + `stop_time_update[]` for the next 5 stops with propagated delay. |
| `GET /healthz` | `application/json` | Status (`ok` / `degraded` / `down`), feed age, miss rate, vehicles tracked/unmatched, current backoff. |

## Behavior when the AVL is down

- Exponential backoff: `30 → 60 → 120 → 240 → 300 s` (cap), reset on the first successful poll.
- When the last successful poll is >120 s old, the `.pb` endpoints still respond `200 OK` with a valid but empty `FeedMessage` (`entity: []`) — OTP logs "no updates" and keeps routing over the static feed without crashing.
- `/healthz` reports `degraded` (60-120 s stale or 10-50 % miss rate) or `down` (>120 s stale or >50 % miss rate).

## Treating the URL as a secret

The AVL upstream URL is treated as a secret across the entire stack:

- **Never** committed to the repo. `.env.example` only carries the placeholder `ORIGIN_AVL=` (no value).
- In CI it comes from `${{ secrets.ORIGIN_AVL }}` (only workflows that need the live URL; the validator smoke uses `file://` mode and does NOT reference the secret).
- The bridge never logs the URL anywhere: HTTP errors (`AxiosError`) are intercepted in `PollerService` and re-emitted as domain errors (`HttpPollError`, `PollTimeoutError`, `PollNetworkError`) whose message does not include the URL.
- `/healthz` does not echo it either.

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
│   └── healthcheck.js        Docker healthcheck (node-based — the image ships no curl)
├── src/
│   ├── main.ts               NestJS bootstrap
│   ├── app.module.ts
│   ├── gtfs/                 Static GTFS loader
│   ├── matcher/              Marker → trip matching (D-05)
│   ├── poller/               Poll loop + parser + backoff (D-06)
│   ├── emitter/              FeedMessage builder (D-08/D-09)
│   ├── rt/                   GET /gtfs-rt/*.pb controllers + empty-feed fallback
│   └── healthz/              GET /healthz controller
└── test/
    └── fixtures/             gtfs-mini + avl-mini + avl-sample
```

## Tests

Implementation **test-first** per [D-11 of the change's design](../openspec/changes/bridge-gtfs-rt/design.md). Every module has its red → green → refactor pair.

```bash
cd bridge && npm test
```

37 tests covering: loader (7), matcher (3), parser (4), poller (9), emitter (4), controller (4), healthz (6).

## CI

| Workflow | Trigger | What it does |
|---|---|---|
| [`bridge.yml`](../.github/workflows/bridge.yml) | push/PR on `bridge/**` | `npm ci`, `npm run lint`, `npm test`, `npm run build`. |
| [`bridge-rt-validate.yml`](../.github/workflows/bridge-rt-validate.yml) | push/PR on `bridge/**`, `data/*.txt`, compose, workflow file | Starts the bridge in fixture mode (`ORIGIN_AVL=file://…`), fetches the `.pb` files, runs MobilityData's `gtfs-realtime-validator`, asserts zero errors. Uploads the `.pb` files + report as an artifact. |

## Refreshing the static GTFS

The bridge loads `data/*.txt` at boot (read-only mount). When the `.txt` files are updated:

```bash
docker compose restart bridge
```

(~3 s downtime). No hot-reload — deliberate choice (design D-04).

## Spec contract

The verifiable contract this service satisfies lives at [`openspec/specs/bridge-gtfs-rt/spec.md`](../openspec/specs/bridge-gtfs-rt/spec.md) (post-archive). Until then: [`openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md`](../openspec/changes/bridge-gtfs-rt/specs/bridge-gtfs-rt/spec.md).
