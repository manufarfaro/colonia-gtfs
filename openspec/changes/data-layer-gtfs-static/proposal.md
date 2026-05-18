## Why

El PRD v0 ([`docs/prd/mvp-v0.md`](../../../docs/prd/mvp-v0.md)) requiere un feed GTFS Schedule estable en `data/` para que OpenTripPlanner pueda planificar viajes y para que el bridge pueda emitir GTFS-RT consistente. Hoy `data/` no existe en el repo. Sin un contrato firme sobre qué archivos viven ahí, qué columnas tienen y cómo se empaquetan para OTP, los specs subsiguientes (`otp-deployment`, `bridge-gtfs-rt`) no pueden definirse. Este change es el primer eslabón del mapeo en PRD §11.

## What Changes

- Definir la estructura del directorio `data/` con los archivos canónicos de GTFS Schedule (`agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`, `shapes.txt`, `feed_info.txt`, `fare_attributes.txt`, `fare_rules.txt`).
- Establecer el esquema de cada archivo: columnas requeridas y opcionales, tipos, encoding UTF-8, fuente conceptual de cada valor.
- Resolver tres open questions del PRD que viven en esta capa:
  - **Q1** — estrategia de `trip_id` (`srv` directo del operador vs sintético `route-service-direction-time`).
  - **Q2** — modelado de L5 (1 route con 2 shapes vs 1 route con 3 shapes).
  - **Q3** — OSM extract de Colonia (`colonia.osm.pbf` commiteado vs descargado en build).
- Definir el contrato de tarifas en GTFS estándar (`fare_attributes.txt` + `fare_rules.txt`) con una estrategia de placeholder explícita si la tarifa no está confirmada con Sol Antigua al momento del merge (PRD §7).
- Definir el script de boot que empaqueta `data/*.txt` en `gtfs.zip` listo para que el container de OTP lo monte.
- Documentar qué archivos se actualizan a mano y cómo (no se autogenera nada en este repo; la captura/procesamiento del AVL es infraestructura privada externa, PRD §3.2).
- Sumar un step de CI que valida el feed contra el MobilityData Canonical GTFS Validator en cada push/PR que toca `data/**`. Falla el build en notices ERROR.
- Definir la dinámica de release cut: rama `release/X.Y.Z` para preparación humana → merge a `main` → push de tag `vX.Y.Z` → GitHub Action publica el GitHub Release con `gtfs.zip` adjunto. Resultado: URL estable `releases/latest/download/gtfs.zip` para que MobilityDatabase y otros consumidores polean.

## Capabilities

### New Capabilities

- `gtfs-static-data`: contrato del data layer estático — archivos GTFS Schedule en `data/`, esquemas por archivo, modelado de fares, OSM extract, y script de empaquetado para OTP.

### Modified Capabilities

_Ninguna — es la primera capability del proyecto._

## Impact

- **New files (cuando se aplique el change):**
  - `data/agency.txt`, `data/stops.txt`, `data/routes.txt`, `data/trips.txt`, `data/stop_times.txt`, `data/calendar.txt`, `data/calendar_dates.txt`, `data/shapes.txt`, `data/feed_info.txt`, `data/fare_attributes.txt`, `data/fare_rules.txt`.
  - `data/colonia.osm.pbf` (Q3 resuelta D-03: commit + script de refresh).
  - `scripts/build-gtfs-zip.sh` (~10 LOC) que empaqueta los `.txt` en `data/output/gtfs.zip` de forma determinista.
  - `scripts/refresh-osm.sh` (regenera `colonia.osm.pbf` desde Geofabrik UY).
  - `scripts/validate-gtfs.sh` (wrapper local de `gtfs-kit` para sanity-check antes de pushear).
  - `data/README.md` con el contrato de mantenimiento manual y cómo flipear fares de placeholder a confirmado.
  - `.github/workflows/validate-gtfs.yml` (CI canónica, corre en push/PR sobre `data/**`).
  - `.github/workflows/release.yml` (build + validate + GitHub Release, corre en tag `v*.*.*`).
  - `docs/release-process.md` documentando el ritual humano de cortar un release.
- **New spec (al apply):** `openspec/specs/gtfs-static-data/spec.md`.
- **Unblocks:** los specs `otp-deployment` (necesita `gtfs.zip` + `colonia.osm.pbf` para mountear) y `bridge-gtfs-rt` (necesita el modelo de `trip_id` para matchear markers AVL → GTFS).
- **External blocking dependency:** tarifa Sol Antigua confirmada (PRD §7). Mitigada por la estrategia de placeholder definida en el spec — el change puede mergearse antes de que la tarifa esté confirmada.
- **Downstream effect:** una vez tageado `v0.0.1`, el feed queda disponible en `https://github.com/manufarfaro/colonia-gtfs/releases/latest/download/gtfs.zip`, listo para registrar en MobilityDatabase (PR a `MobilityData/mobility-database-catalogs` o el formulario web, fuera del scope de este change pero habilitado por él).
- **Repo no público:** captura/procesamiento del AVL (poller, JSONL crudos, processor) — sigue siendo infra privada externa (PRD §10.5 del relevamiento).
