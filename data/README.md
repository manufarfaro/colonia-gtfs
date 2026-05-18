# `data/` — Static GTFS Schedule feed

Este directorio contiene los archivos GTFS Schedule canónicos de **Sol Antigua** urbano Colonia del Sacramento. Es el contrato que consumen:

- **OpenTripPlanner** (el motor de planning del producto — ver el spec `otp-deployment`).
- **El bridge** para emitir GTFS-RT contra estos identificadores (ver el spec `bridge-gtfs-rt`).
- **Consumidores externos** vía el `gtfs.zip` publicado en GitHub Releases.

## Mantenimiento

Los archivos `.txt` se editan **a mano**, no se autogeneran. Las fuentes upstream son los CSV procesados que viven en infra privada externa al repo (PRD §3.2 y relevamiento §10.5). El flujo de update:

1. El operador externo (privado) refresca `data/processed/*.csv` con datos nuevos.
2. Editor humano traduce los CSV a `data/*.txt` aplicando las reglas del [spec](../openspec/specs/gtfs-static-data/spec.md): `direction_id` derivado de `tra`, `trip_id` sintético + `original_trip_id` = `srv` del operador, omitir stops de confianza baja, etc.
3. Sanity check local antes de pushear:
   ```bash
   scripts/build-gtfs-zip.sh
   scripts/validate-gtfs.sh
   ```
4. Commit con mensaje `data: refresh GTFS Schedule from processed CSV YYYY-MM-DD`.
5. Push → el CI corre el MobilityData Canonical Validator (`.github/workflows/validate-gtfs.yml`).

## Tarifas: placeholder ↔ confirmado

Mientras no haya tarifa confirmada con Sol Antigua, `fare_attributes.txt` lleva un único row con `fare_id = standard-pending`, `price = 0.00`, `currency_type = UYU`. El viewer detecta `price == 0` y muestra "consultá al chofer".

Para flipear a modo confirmado:

1. Cambiar la fila en `fare_attributes.txt`: `fare_id = standard`, `price = <monto real>`.
2. Quitar la nota "datos preliminares · tarifas a confirmar" de `feed_info.txt`.
3. Commit: `data: confirm Sol Antigua fare ($XX UYU)`.

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
