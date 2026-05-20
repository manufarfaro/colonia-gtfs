## Context

[Spec previo](../../specs/gtfs-static-data/spec.md) (capability `gtfs-static-data`, archivada en `archive/2026-05-18-data-layer-gtfs-static`) ya entrega:

- `data/*.txt` (11 archivos GTFS Schedule) + `data/colonia.osm.pbf` (532 KB).
- `tooling/scripts/build_gtfs_zip.py` empaqueta los `.txt` en `data/output/gtfs.zip` (byte-determinístico, ~36 KB).
- Validación en CI vía MobilityData Canonical Validator (workflow `validate-gtfs.yml`).
- Release pipeline tag-driven (`release.yml`) publica `gtfs.zip` en GitHub Releases.

Constraints heredados del PRD:

- Stack v0 = single-host Docker compose. Sin k8s, sin multi-host.
- Producto = "viewer turístico estilo Google Maps". OTP es el *brain* invisible.
- `otp-routing` solo expone HTTP en la red interna de Docker — el BFF (spec siguiente) la proxea hacia afuera.
- Memoria objetivo: ~1 GB JVM heap (feed chico, OSM clip chico, no necesita más).

## Goals / Non-Goals

**Goals:**

- Container de OTP funcional, ejecutable con un solo `docker compose up`.
- Mounts directos al `data/output/gtfs.zip` que produce el build-script local + `data/colonia.osm.pbf` committeado.
- `router-config.json` declarando los GTFS-RT updaters que apuntan al **bridge** (servicio sibling todavía no implementado; el contrato de URLs queda fijado acá).
- API HTTP estable para que el BFF (spec siguiente) la consuma.
- Healthz, logs sensibles, pin de versión.
- Procedimiento de boot/rebuild documentado, reproducible en CI y en hosts de demo.

**Non-Goals:**

- Cómo se autorizan / autentican las requests a OTP (la API queda solo en la red interna de Docker; el control de acceso lo maneja el BFF, fuera de scope acá).
- El bridge en sí — sus contratos solo se *declaran* desde este spec; la implementación es `bridge-gtfs-rt`.
- El BFF / viewer — sus contratos son specs siguientes que *consumen* esta capability.
- Multi-router (varias agencias / regiones). v0 = un solo router default.
- Optimización de performance avanzada (caches custom, sharding, etc.).
- Análisis isócrono / batch routing (r5/Conveyal territory).

## Decisions

### D-01 — Ubicación del compose: raíz del repo, single file

**Decisión:** `docker-compose.yml` en la raíz del repo. Una sola definición YAML para todo el stack v0 (OTP ahora; bridge, BFF, viewer se sumarán en specs siguientes como nuevos services dentro del mismo file).

**Por qué:**

- `docker compose up` desde el repo root es el comando que documenta el `release-process.md` y el README. No partir en archivos por servicio.
- `compose.override.yml` queda como vía pública para overrides locales (env vars, ports remapping, etc.) sin ensuciar el principal.
- Cuando crezca, se puede modular con `include:` (Compose v2.20+) sin migración.

**Alternativa descartada:** `deployment/docker-compose.yml`. Innecesario un nivel extra de directorio cuando el repo es chico.

### D-02 — Config files de OTP bajo `deployment/otp/`

**Decisión:** `router-config.json` (y, si hace falta, `build-config.json`) viven bajo `deployment/otp/`. El compose monta ese directorio dentro del container junto con los datos:

```yaml
otp:
  image: opentripplanner/opentripplanner:2.10.0
  command: ["--build", "--serve", "/var/opentripplanner"]
  volumes:
    - ./data/output/gtfs.zip:/var/opentripplanner/gtfs.zip:ro
    - ./data/colonia.osm.pbf:/var/opentripplanner/colonia.osm.pbf:ro
    - ./deployment/otp/router-config.json:/var/opentripplanner/router-config.json:ro
```

**Por qué:**

- `deployment/` separa archivos de infrastructure (config de runtime) del código del producto. Sigue la convención de `tooling/` (Python project) y `data/` (datasets).
- Read-only mounts (`:ro`) — OTP no debe escribir en estos archivos, son input estático.

### D-03 — Imagen upstream sin custom Dockerfile

**Decisión:** Usar `opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42` (pin exacto) sin Dockerfile propio. La imagen oficial incluye Temurin JDK 25 + el JAR de OTP 2.10.

**Por qué:**

- La imagen upstream es mantenida por la fundación OpenTripPlanner y publicada en cada release. Auditarla nosotros sería overhead sin valor agregado para v0.
- Si más adelante hay que sumar herramientas (curl, jq) en el container o aplicar tweaks de JVM, se introduce un `Dockerfile` chico que extiende la upstream. Esa puerta queda abierta sin pagar costo ahora.
- Pin con el tag completo (no `:latest`, no `:2.10.0_<latest>`) para reproducibilidad. Bump explícito vía PR cuando salga una nueva versión.

### D-04 — Build del grafo al boot, sin persistencia

**Decisión:** OTP construye el grafo al iniciar el container (modo `--build --serve`) y lo mantiene en memoria. **No** persiste el grafo a disco — al reiniciar, vuelve a construir.

**Por qué:**

- Tamaño del grafo: con `gtfs.zip` (~36 KB de transit) + `colonia.osm.pbf` (~532 KB de OSM), OTP construye el grafo en bajo segundos (típicamente <15s para un feed urbano chico).
- Persistir agrega complejidad (named volume, invalidation cuando cambian inputs, gestión de versiones del grafo) sin acelerar lo suficiente para que valga la pena en v0.
- Cada `docker compose up` con `gtfs.zip` nuevo (post `tooling/scripts/build_gtfs_zip.py`) garantiza grafo fresco — cero confusión sobre "qué versión del feed está cargada".

**Trade-off:** Restart del container = 5-15s de unavailability mientras construye el grafo. Aceptable para demo cerrado; reconsiderar si v0.1+ pasa a público con SLO de uptime.

### D-05 — JVM heap fijo en `-Xmx1g`

**Decisión:** Setear `JAVA_TOOL_OPTIONS=-Xmx1g -Xms512m` en el service del compose. Heap máximo 1 GB, inicial 512 MB.

**Por qué:**

- Docs de OTP advierten "1 GB+ para feeds chicos". Para Colonia (~130 stops, ~120 trips) el grafo entero entra en mucho menos, pero `-Xmx1g` deja headroom para el procesamiento de queries simultáneas sin GC churn.
- `-Xms512m` evita que el heap crezca incremental al inicio (latencia más predecible en cold start).
- No tocar `-XX:` flags exóticos. Si aparece un problema de performance lo investigamos con datos.

### D-06 — Puerto interno `8080`, expuesto solo dentro de la red Docker

**Decisión:** OTP escucha en `8080` (default). El compose lo deja **sin** `ports:` exposed al host. El BFF lo accede como `http://otp:8080` vía red interna de Docker.

**Por qué:**

- API de OTP no es para consumo público — el BFF (spec siguiente) la proxea con la URL `http://otp:8080/otp/routers/default/...`.
- Sin port mapping al host significa que un atacante externo no puede llegar a OTP directamente (defense in depth, aunque OTP esté detrás del firewall de la VPS).
- Para debug local, `docker compose port otp 8080` o un `compose.override.yml` con `ports: ["8081:8080"]` resuelven.

### D-07 — GTFS-RT updaters: contrato para el bridge

**Decisión:** `router-config.json` declara dos updaters apuntando al servicio sibling `bridge` (que será definido por el spec `bridge-gtfs-rt`):

```json
{
  "updaters": [
    {
      "type": "vehicle-positions",
      "feedId": "sol-antigua",
      "url": "http://bridge:3001/gtfs-rt/vehicle-positions.pb",
      "frequency": "15s",
      "fuzzyTripMatching": true
    },
    {
      "type": "stop-time-updater",
      "feedId": "sol-antigua",
      "url": "http://bridge:3001/gtfs-rt/trip-updates.pb",
      "frequency": "30s"
    }
  ]
}
```

**Contrato declarado acá:**

- El bridge **SHALL** exponer esas dos URLs HTTP sobre el puerto `3001` interno.
- Cada endpoint **SHALL** responder con un GTFS-Realtime FeedMessage en formato protobuf, content-type `application/x-protobuf`.
- Los `feedId` coinciden con `agency_id` de `data/agency.txt` (`sol-antigua`).
- Si el bridge está caído, OTP loguea + sigue sirviendo el feed estático sin RT (no se cae OTP).

**Por qué estas frecuencias:**

- `vehicle-positions` cada 15s: refresh denso para que el mapa muestre buses en tiempo casi-real. Bajar de 15s da diminishing returns (los markers en el AVL upstream se actualizan cada 30s).
- `stop-time-updater` cada 30s: ETAs no cambian tan rápido como posiciones; 30s suficiente.

**Por qué `fuzzyTripMatching: true`:** los `trip_id` que produce el bridge pueden tener mínimas variaciones (timing offsets); el matching fuzzy de OTP los tolera sin requerir match exacto.

### D-08 — Healthz endpoint + CI smoke test

**Decisión:** Usar `GET /otp/actuators/health` (incluido en OTP 2.10) como healthz. Compose declara `healthcheck:` que pega al endpoint vía `bash` + `/dev/tcp` (sin depender de tools externos).

**Por qué no `curl`:** la imagen `opentripplanner/opentripplanner:2.10.0_2026-05-13T17-42` (Ubuntu 26.04 minimal) **no** trae `curl`, `wget`, `nc`, ni `socat`. Sí trae `bash` y `perl`. Para evitar un Dockerfile custom (D-03) usamos un one-liner bash:

```yaml
healthcheck:
  test:
    - CMD
    - bash
    - -c
    - "exec 3<>/dev/tcp/localhost/8080 && printf 'GET /otp/actuators/health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -1 <&3 | grep -q ' 200 '"
```

Si más adelante se introduce un Dockerfile custom (por otra razón), se puede simplificar a `curl -fsS`. La forma del spec solo exige "probar `/otp/actuators/health` y aceptar 200", no un binario específico.

CI: sumar `.github/workflows/otp-smoke.yml` que:

1. Checkout.
2. Build `gtfs.zip` con `uv run --directory tooling python scripts/build_gtfs_zip.py`.
3. `docker compose -f docker-compose.yml -f compose.override.ci.yml up -d otp` (override expone 8080 al runner).
4. Wait for `/otp/actuators/health` con timeout de 90s.
5. `POST /otp/gtfs/v1` con un GraphQL `plan` query (coords de Colonia urbano) y verificar que `data.plan.itineraries[0].legs[0]` exista.
6. `docker compose down`.

El workflow corre en push/PR sobre `deployment/otp/**`, `data/**`, `docker-compose.yml`, `compose.override.ci.yml`, `tooling/**` y el workflow file mismo.

**Por qué smoke en CI:** validar que OTP arranca con el grafo construido y responde queries reales — el equivalente del Canonical Validator pero para el motor de planning. Sin esto, un error en `router-config.json` solo se detecta en deploy.

**Sobre el endpoint de routing:** OTP 2.10 **removió** la REST `/otp/routers/default/plan` y expone routing solo vía GraphQL en `POST /otp/gtfs/v1`. El CI smoke test y el BFF (spec siguiente `bff-api-and-routes`) consumen ese endpoint.

**Sobre el feature flag de actuators:** OTP 2.10 trae `ActuatorAPI` **off** por default. Para exponer `/otp/actuators/health` agregamos `deployment/otp/otp-config.json` con `{ "otpFeatures": { "ActuatorAPI": true } }` y lo mounteamos al container.

### D-09 — Logs por stdout, sin file appenders custom

**Decisión:** OTP por defecto loguea a stdout. El compose recoge esos logs (`docker compose logs otp`). No configurar Logback custom en v0.

**Por qué:**

- 12-factor app: logs a stdout, el orquestador se encarga del transporte.
- En la VPS de demo basta `journalctl -u docker` o `docker compose logs --tail=200 otp`. Sin necesidad de stack de observabilidad propia.
- Cuando v0.1+ pase a público y queramos agregación (Loki, Cloudwatch, etc.), se configura desde fuera del container.

### D-10 — Versión pin con bump explícito

**Decisión:** El tag de la imagen va pineado al SHA-friendly `2.10.0_2026-05-13T17-42`. Bumps suceden vía PR que cambia el tag + corre el CI smoke. No se usa `:latest` ni floating tags.

**Por qué:**

- Misma filosofía que `uv.lock` para Python: reproducibilidad determinística.
- Un release `vX.Y.Z` del feed + un tag de imagen pinneada = combinación documentada y debugable.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **El bridge no existe todavía → OTP arranca pero sin RT data** | OTP por design tolera updaters down: loguea, sigue sirviendo el feed estático. El spec `bridge-gtfs-rt` siguiente respeta las URLs declaradas en D-07. Tests de smoke (D-08) corren contra OTP sin bridge: rutean OK sobre el feed estático. |
| **Cambio de schema en `router-config.json` entre versiones de OTP** | Pin de versión (D-10) elimina el riesgo de bump silencioso. Bumps vía PR con smoke test verifica que la config sigue válida. |
| **Memory pressure si feed crece mucho** | v0 cobre 4 routes / 130 stops — muy por debajo del threshold de 1 GB heap. Si v0.2+ suma ABC Coop u otros operadores y el feed crece a >1000 stops, revisar `-Xmx`. |
| **Grafo se construye al boot → restart toma ~10s** | Aceptable para demo cerrado. Si v0.1+ exige uptime estricto, persistir el grafo (D-04 trade-off documentado). |
| **Mount read-only de `gtfs.zip` queda stale si se olvida el rebuild** | Documentar el flow en `data/README.md`: editar `data/*.txt` → `uv run --directory tooling python scripts/build_gtfs_zip.py` → `docker compose restart otp`. CI valida que el `.zip` se reconstruya antes del `up`. |
| **El contrato de URLs del bridge (D-07) cambia antes de que se implemente** | El spec `bridge-gtfs-rt` siguiente lee este design.md como input y respeta D-07. Si surge razón fuerte para cambiar (ej. bridge en puerto distinto), se modifica este spec primero, con merge antes del de bridge. |

## Migration Plan

No aplica: es la creación inicial del servicio. No hay estado previo del que migrar.

Cuando se aplique este change:

1. Crear `docker-compose.yml` en raíz del repo con el service `otp` declarado.
2. Crear `deployment/otp/router-config.json` (y opcionalmente `build-config.json`).
3. Crear `deployment/README.md` con instrucciones de boot, env vars, troubleshooting.
4. Sumar `.github/workflows/otp-smoke.yml` (CI smoke test).
5. Actualizar root `README.md` con sección "Stack" / "Local development" describiendo el `docker compose up otp`.

## Open Questions

Ninguna bloqueante para escribir el spec. Quedan dos seguimientos que pertenecen a specs adyacentes:

- **Bridge URLs** — declarados en D-07 como contrato; el spec `bridge-gtfs-rt` siguiente los implementa. Si surge razón para cambiar, este spec se modifica primero.
- **BFF auth model** — `otp-routing` queda en red interna de Docker. El control de acceso público es problema del BFF (spec `bff-api-and-routes`).
