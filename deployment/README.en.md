# `deployment/` — v0 runtime stack

[Español](README.md) · **English**

Infrastructure config for the v0 stack services:

- **`otp`** — OpenTripPlanner 2, the routing engine over the static feed.
- **`bridge`** — NestJS service that polls the AVL and exposes GTFS-RT to OTP. Detail in [`bridge/README.en.md`](../bridge/README.en.md).
- **`viewer`** — Next.js app (UI + API routes / BFF). The only container with a public port. Detail in [`viewer/README.en.md`](../viewer/README.en.md).

[![OTP Smoke](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/otp-smoke.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/otp-smoke.yml)

## Layout

```
deployment/
└── otp/
    ├── otp-config.json      Feature flags (enables ActuatorAPI)
    └── router-config.json   GTFS-RT updaters (vehicle-positions, stop-time-updater)
```

The `docker-compose.yml` and `compose.override.yml.example` live at the **repo root** (decision [D-01](../openspec/changes/otp-deployment/design.md#d-01--ubicación-del-compose-raíz-del-repo-single-file)).

## Prerequisites

- Docker + Docker Compose v2 (with the daemon running).
- Python toolchain synced: `uv sync --directory tooling` (see [`tooling/README.en.md`](../tooling/README.en.md)).
- `data/output/gtfs.zip` built: the compose file mounts it read-only and will fail at boot if it's missing.

```bash
# 1. Build the packaged feed (OTP input)
uv run --directory tooling python scripts/build_gtfs_zip.py

# 2. Bring OTP up
docker compose up otp
```

Typical graph build time: **5–15 seconds** for the current Sol Antigua feed (130 stops, ~500 KB clipped OSM). Once it logs `Grizzly server running` and `/otp/actuators/health` returns `200`, it's ready for queries.

## Routing API

OTP 2.10 dropped the REST `/otp/routers/default/plan` endpoint. Routing is consumed via GraphQL at `POST /otp/gtfs/v1`. Example:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"query":"query { plan(from: {lat: -34.4712, lon: -57.8520}, to: {lat: -34.4470, lon: -57.8440}, transportModes: [{mode: TRANSIT},{mode: WALK}]) { itineraries { legs { mode duration route { shortName } } } } }"}' \
  http://localhost:8080/otp/gtfs/v1
```

The BFF (next spec `bff-api-and-routes`) will proxy this endpoint to the viewer.

## Ports and network

In v0 the **only service with `ports:` in the base `docker-compose.yml` is the viewer** (public port `${VIEWER_PORT:-8080}`). OTP and the bridge are only reachable via Docker's internal network:

| Service | Internal port | Exposed to host by default | How clients reach it |
|---|---|---|---|
| `viewer` | 8080 | yes (`8080`) | browser → `http://localhost:8080` |
| `otp` | 8080 | no | viewer → `http://otp:8080` |
| `bridge` | 3001 | no | viewer + otp → `http://bridge:3001` |

To `curl` OTP or the bridge directly from your machine, copy [`compose.override.yml.example`](../compose.override.yml.example) → `compose.override.yml` and uncomment the ports. The real override is gitignored. CI uses a parallel committed file `compose.override.ci.yml` that workflows invoke explicitly via `-f`.

## JVM heap

Default: `-Xmx1g -Xms512m` (decision [D-05](../openspec/changes/otp-deployment/design.md#d-05--jvm-heap-fijo-en--xmx1g)). To override:

```yaml
services:
  otp:
    environment:
      JAVA_TOOL_OPTIONS: "-Xmx2g -Xms512m"
```

## Realtime (bridge)

The `bridge` service polls the operator's AVL, matches markers against the static GTFS, and exposes the two `.pb` endpoints OTP polls every 15/30 s.

- **Service runtime:** see [`bridge/README.en.md`](../bridge/README.en.md) — NestJS stack, endpoint contract, rich healthz JSON, handling of the `ORIGIN_AVL` secret.
- **Spec contract:** [`openspec/specs/bridge-gtfs-rt/spec.md`](../openspec/specs/bridge-gtfs-rt/spec.md) (post-archive of the change).
- **Boot:** `docker compose up bridge otp` (or just `docker compose up` for the full stack). The bridge resolves `ORIGIN_AVL` from `.env` (gitignored).
- **Offline smoke:** `ORIGIN_AVL=file:///app/test/fixtures/avl-sample.xml` lets the stack run without hitting the operator — used by the `bridge-rt-validate.yml` workflow.

OTP starts and routes over the static feed with or without the bridge running (R-05 scenario 3 of `otp-routing`). To verify the stale path explicitly, see the subsection below.

## Bridge absent — expected behavior

`router-config.json` declares two GTFS-RT updaters pointing at the `bridge` service (port 3001):

| Updater | URL | Frequency |
|---|---|---|
| `vehicle-positions` | `http://bridge:3001/gtfs-rt/vehicle-positions.pb` | 15s |
| `stop-time-updater` | `http://bridge:3001/gtfs-rt/trip-updates.pb` | 30s |

The `bridge` service is implemented by the [next spec `bridge-gtfs-rt`](../openspec/changes/) — it doesn't exist yet. In the meantime:

- OTP starts and builds its graph fine.
- Logs connection errors to `bridge:3001` every 15/30 seconds (expected).
- `/otp/actuators/health` still returns `200`.
- Queries to `/otp/routers/default/plan` work over the **static** feed (no realtime positions or delays).

This is deliberate (decision [D-07](../openspec/changes/otp-deployment/design.md#d-07--gtfs-rt-updaters-contrato-para-el-bridge)): the URL contract is pinned by this spec and the bridge spec will honor it.

## Healthcheck

Compose declares:

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

Why not `curl`? The `opentripplanner/opentripplanner:2.10.*` image (Ubuntu 26.04 minimal) does not include `curl`, `wget`, or `nc`. To avoid a custom Dockerfile (decision [D-03](../openspec/changes/otp-deployment/design.md#d-03--imagen-upstream-sin-custom-dockerfile)) we use a `bash` one-liner over `/dev/tcp`, which the image does ship. The spec's contract only requires probing `/otp/actuators/health` and accepting `200` — not any specific binary.

OTP 2.10 ships the `ActuatorAPI` feature enabled by default — `/otp/actuators/health` is available with no additional config in `router-config.json`.

## Version pin

The image is pinned to the exact tag in `docker-compose.yml`:

```
opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42
```

Bumps happen via explicit PR that bumps the tag + runs `otp-smoke.yml` (decision [D-10](../openspec/changes/otp-deployment/design.md#d-10--versión-pin-con-bump-explícito)). Never `:latest`.

## Build-config / Otp-config

- **`otp-config.json`**: present, enables the `ActuatorAPI` feature (off by default in OTP 2.10) — required for `/otp/actuators/health` to exist.
- **`build-config.json`**: not needed. OTP 2.10 auto-detects inputs:
  - `*.zip` in `/var/opentripplanner/` → GTFS feed (`gtfs.zip`).
  - `*.osm.pbf` in `/var/opentripplanner/` → OSM graph (`colonia.osm.pbf`).

If at some point the build needs tuning (e.g. `subwayAccessTime`, custom `osmTagMapping`), add `deployment/otp/build-config.json` and mount it to the same path.

## CI

The [`otp-smoke.yml`](../.github/workflows/otp-smoke.yml) workflow brings the container up on every PR that touches:

- `deployment/otp/**`
- `docker-compose.yml`
- `data/*.txt`, `data/colonia.osm.pbf`
- `tooling/scripts/build_gtfs_zip.py`, `tooling/pyproject.toml`, `tooling/uv.lock`

Steps: build `gtfs.zip` → `docker compose up otp` → wait healthz → query `/plan` (a real Colonia urban trip-plan) → assert at least one itinerary → tear down. It's the equivalent of the MobilityData Canonical Validator but for the planning engine (decision [D-08](../openspec/changes/otp-deployment/design.md#d-08--healthz-endpoint--ci-smoke-test)).

## Spec

The verifiable contract this deployment satisfies lives at [`openspec/specs/otp-routing/spec.md`](../openspec/specs/otp-routing/spec.md) (post-archive of the `otp-deployment` change). Until then, the draft spec is at [`openspec/changes/otp-deployment/specs/otp-routing/spec.md`](../openspec/changes/otp-deployment/specs/otp-routing/spec.md).
