# `data/` — Static GTFS Schedule feed

Este directorio contiene los archivos GTFS Schedule canónicos del sistema de transporte urbano de Colonia del Sacramento, hasta donde el relevamiento avanzó. Es el contrato que consumen:

- **OpenTripPlanner** (el motor de planning del producto — ver el spec `otp-deployment`).
- **El bridge** para emitir GTFS-RT contra estos identificadores (ver el spec `bridge-gtfs-rt`).
- **Consumidores externos** vía el `gtfs.zip` publicado en GitHub Releases.

## Operadores evaluados

| Operador | Líneas en v0 | Estado del relevamiento |
|---|---|---|
| **Sol Antigua** | 3, 4, 5, 8 | Captura AVL activa desde 2026-05-13; data suficiente para `routes`, `stops`, `trips`, `stop_times`, `shapes`. |
| **ABC Coop** | — | Relevamiento pendiente; sin captura ni acuerdo todavía. Entra al feed en v0.1+. |

## Mantenimiento

Los archivos `.txt` se editan **a mano**, no se autogeneran. Las fuentes upstream son los CSV procesados que viven en infra privada externa al repo (PRD §3.2 y relevamiento §10.5). El flujo de update:

1. El operador externo (privado) refresca `data/processed/*.csv` con datos nuevos.
2. Editor humano traduce los CSV a `data/*.txt` aplicando las reglas del [spec](../openspec/specs/gtfs-static-data/spec.md): `direction_id` derivado de `tra`, `trip_id` sintético + `original_trip_id` = `srv` del operador, omitir stops de confianza baja, etc.
3. Sanity check local antes de pushear (desde la raíz del repo):
   ```bash
   uv run --directory tooling python scripts/build_gtfs_zip.py
   uv run --directory tooling python scripts/validate_gtfs.py
   ```
4. Commit con mensaje `data: refresh GTFS Schedule from processed CSV YYYY-MM-DD`.
5. Push → el CI corre el MobilityData Canonical Validator (`.github/workflows/validate-gtfs.yml`).

## Tarifas

`fare_attributes.txt` modela el boleto urbano base publicado por Sol Antigua:
`fare_id = standard`, `price = 40.00`, `currency_type = UYU`,
`payment_method = 0`, `transfers = 0`.

La lista pública de precios también menciona boletos B ($45, 2 zonas),
boletos C ($55, combinado), abonos de 40 boletos y tarjeta ($200). El feed v0
no modela esos productos porque todavía no tiene zonas tarifarias ni reglas de
combinación; `fare_rules.txt` aplica la tarifa A de 1 zona a las rutas urbanas
3, 4, 5 y 8.

Si se agregan zonas tarifarias:

1. Agregar `zone_id` en `stops.txt` o las reglas necesarias en GTFS Fares.
2. Crear filas adicionales en `fare_attributes.txt` para B/C.
3. Extender `fare_rules.txt` con las reglas de aplicación por ruta/zona.

## Archivos

| Archivo | Contenido |
|---|---|
| `agency.txt` | Sol Antigua: ID, nombre, URL, teléfono, email |
| `stops.txt` | ~130 paradas (alta + media confianza del relevamiento) |
| `routes.txt` | Cuatro líneas urbanas: 3, 4, 5, 8 |
| `trips.txt` | ~138 templates, `trip_id` sintético + `original_trip_id` |
| `stop_times.txt` | Tiempos inferidos por offsets medianos (relevamiento §7) |
| `calendar.txt` | Cuatro servicios: `weekday`, `saturday`, `sunday`, `holiday` |
| `calendar_dates.txt` | Feriados UY 2026 como excepciones |
| `shapes.txt` | 11 shapes (2 por L3/L4/L8 + 3 para L5) |
| `feed_info.txt` | Publisher, versión, contacto |
| `fare_attributes.txt` + `fare_rules.txt` | Tarifa única (placeholder o confirmada) |
| `colonia.osm.pbf` | Recorte OSM de Colonia urbano para el walking graph de OTP |

Build artefacts (no en git):

- `output/gtfs.zip` — empaquetado producido por `scripts/build-gtfs-zip.sh`.

## Licencia

El contenido de este directorio y el `gtfs.zip` publicado en GitHub Releases se distribuyen bajo [CC BY 4.0](LICENSE). Si reutilizás el feed (consumo directo, derivados, mashups), atribuí a `colonia-gtfs` con link al repo. El código del resto del monorepo está bajo MIT — ver [`/LICENSE`](../LICENSE).
