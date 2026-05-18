## Context

El repo hoy tiene la cáscara del proyecto (PRD, scaffolding OpenSpec, READMEs) pero no contiene ni un solo archivo GTFS Schedule. El PRD v0 establece que la implementación del producto se monta sobre un feed estático versionado en `data/` (PRD §3.2, §6.2). Este spec define ese contrato.

**Fuentes de información para los valores** (no parte del repo público, infra privada externa al producto — PRD §10.5):

- `data/avl-log/*.jsonl` — 5+ días de captura del AVL Sol Antigua (markers crudos).
- `data/processed/{routes,trips,stops}.csv` + `shapes.geojson` + `quality_report.md` — agregados que produce el script de procesamiento privado y que sirven de input para llenar los `.txt` canónicos.
- `relevamiento-mvp.md` §3, §4, §6 — captura, métricas, mapeo AVL → GTFS.
- `cruce-spec-vs-datos-y-esquema-v1.md` — bugs corregidos en el cruce con datos reales (`sen` constante, `bpp` capacidad nominal).

**Constraints heredados del PRD:**

- Operador único en v0: Sol Antigua.
- 4 líneas (`lin` 3, 4, 5, 8). L5 con disclaimer visible por baja muestra.
- Encoding UTF-8 en los `.txt` (la fuente AVL es ISO-8859-1; la conversión ocurre fuera del repo).
- Tarifa modelada en GTFS estándar (`fare_attributes` + `fare_rules`); el valor concreto es dependencia bloqueante.
- Sin `gtfs-builder` dinámico — los `.txt` se mantienen a mano.

## Goals / Non-Goals

**Goals:**

- Definir el contrato verificable de cada archivo en `data/`: columnas requeridas, opcionales, tipos, semántica.
- Resolver las tres open questions Q1, Q2, Q3 del PRD que viven en esta capa.
- Establecer la estrategia de placeholder para fares mientras la tarifa no esté confirmada con Sol Antigua, de modo que el spec pueda mergearse sin bloquearse en una dependencia externa.
- Definir el script de empaquetado que produce `gtfs.zip` para OTP.
- Documentar el flujo de mantenimiento (qué se edita a mano, cuándo, cómo se valida localmente con `gtfs-kit`).

**Non-Goals:**

- Cómo se capturan los datos del AVL (infra privada, fuera del repo).
- Cómo se generan los CSV de `data/processed/` (idem).
- El stack del bridge ni cómo emite GTFS-RT (cubre `bridge-gtfs-rt`).
- La config de OTP, sus mounts ni el `router-config.json` (cubre `otp-deployment`).
- El renderizado del feed en el viewer (cubre `viewer-*`).
- Sumar `agency.txt` con múltiples operadores (queda para v0.2+ con ABC Coop u otros).

## Decisions

### D-01 — `trip_id` sintético, con `srv` preservado como columna no-estándar

**Decisión:** `trip_id = "{route_id}-{service_id}-{direction_id}-{HHMM}"` (ej. `4-weekday-0-0830`).

El `srv` del operador (estable y único por `(lin, sal, lnm)` según relevamiento §4.5) se guarda en una columna **no-estándar** `original_trip_id` en `trips.txt`. GTFS permite columnas adicionales sin romper validadores.

**Por qué sobre la alternativa A (`trip_id = srv` directo):**

- **Legibilidad en logs y debugging.** El sintético se autodescribe: línea, servicio, dirección, hora.
- **Inmunidad a reciclaje de `srv`.** El relevamiento (§9, riesgo "srv se recicla anualmente") flagga este riesgo como probabilidad media; con sintético el problema no existe.
- **Tests deterministas.** El sintético es función pura de inputs visibles.
- **`original_trip_id` no pierde información** para matching del bridge contra markers AVL.

**Trade-off:** consumidores externos del feed que esperaran el `srv` del operador como `trip_id` reciben otra cosa. En v0 no hay consumidores externos (out-of-scope), y la columna `original_trip_id` cubre el caso si aparecieran.

### D-02 — L5 modelada como 1 route con 3 shapes (una por `tra`)

**Decisión:** `routes.txt` tiene una fila para L5 (`route_id = 5`). `trips.txt` tiene 3 grupos de trips para L5, uno por `tra` ∈ {1, 2, 4}. `shapes.txt` tiene 3 shapes distintos referenciados desde esos trips:

- `tra=1` → `shape_id=5-out-r1` (El General vía Ruta 1)
- `tra=2` → `shape_id=5-in-r1` (Centro vía Ruta 1)
- `tra=4` → `shape_id=5-in-direct` (Centro, recorrido directo)

**Por qué sobre las alternativas:**

- **(a) 1 route con 2 shapes:** colapsa tra=2 y tra=4 en un solo shape inbound, pero geográficamente son distintos (uno usa Ruta 1, el otro no). Esto miente al turista.
- **(c) 2 routes (`5` y `5-r1`):** el operador no separa así; el turista en la parada ve "Línea 5" y no distingue variantes en su mapa mental. Inflar el namespace de routes es más confuso que tener trips alternativos.
- **(b) 1 route con 3 shapes (elegida):** modela fielmente la realidad operacional; es lo que GTFS está diseñado para soportar (un route con múltiples shapes/trips).

**Trade-off:** L5 tiene **muy poca muestra** (20 + 43 + 385 markers vs miles para L4). Los shapes derivados de `tra=1` y `tra=2` serán ruidosos. **Mitigación:** disclaimer específico para L5 visible en el viewer (alcance del spec del viewer, no de este). El feed expone la realidad capturada; la UI maneja la calidad.

### D-03 — `colonia.osm.pbf` commiteado en `data/`, con script de refresh manual

**Decisión:** Commitear `data/colonia.osm.pbf` (extract de Geofabrik UY recortado por bbox de Colonia urbano). Agregar `scripts/refresh-osm.sh` para regenerarlo cuando haga falta.

**Por qué sobre descarga en build:**

- **Reproducibilidad:** clonar y correr produce el mismo resultado, hoy y dentro de 6 meses.
- **Offline-friendly y CI sin red externa:** el container de OTP arranca sin depender de Geofabrik estar arriba.
- **Tamaño:** el extract de Colonia urbano por bbox queda en ~500 KB-1 MB; aceptable en git aunque sea binario.
- **Refresh on-demand:** OSM cambia lentamente para una ciudad chica; semestral o anual basta. El script `refresh-osm.sh` deja un commit verificable.

**Trade-off:** binarios en git no son diffables. Mitigación: el script está versionado y es determinista; cualquiera puede regenerar el `.pbf` y comparar el resultado.

**Bbox propuesto:** `-57.92,-34.51,-57.78,-34.42` (cobertura Colonia urbano + áreas servidas por las 4 líneas, incluyendo Real de San Carlos y Algodones).

### D-04 — Estrategia de placeholder para fares

**Decisión:** El spec define el esquema completo de `fare_attributes.txt` + `fare_rules.txt` con dos modos:

- **Modo "placeholder":** mientras la tarifa no está confirmada con Sol Antigua, el archivo tiene un único `fare_id = standard-pending` con `price=0.00`, `currency_type=UYU`, `payment_method=0` (paid onboard), `transfers=0`. El viewer detecta `price == 0` y renderiza el texto "Consultá la tarifa al chofer" en vez de un monto.
- **Modo "confirmado":** el `fare_id` pasa a ser `standard`, `price` es el valor real, mismo resto. El viewer renderiza "$XX UYU".

**Por qué:**

- Permite mergear el spec y arrancar el resto del pipeline antes de que la dependencia externa esté resuelta (PRD §7 deja la tarifa como bloqueante para release, no para spec).
- Los validadores GTFS aceptan `price=0.00` (es un fare gratis válido); no rompe validación.
- La transición de placeholder a confirmado es un cambio de valor, no de esquema — cero refactor downstream.
- El viewer maneja el sentinel `price == 0` en su spec; este spec solo lo declara.

**Trade-off:** un consumidor externo del feed en modo placeholder ve "viaje gratis". Mitigación: `feed_info.txt` lleva una nota en `feed_publisher_name` o equivalente diciendo "datos preliminares - tarifas a confirmar" mientras estemos en placeholder. Y el v0 no se hace público hasta que la tarifa esté confirmada (PRD §7 — bloquea release, no merge).

### D-05 — Direction_id derivado de `tra`, sin fallback a heurística de headsign

**Decisión:** `direction_id` se asigna durante la generación manual de `trips.txt` siguiendo la regla del relevamiento §6.1:

- `direction_id = 1` si el trip corresponde a `tra = 1` (outbound).
- `direction_id = 0` si el trip corresponde a `tra ∈ {2, 4}` (inbound, hacia Centro).

**Por qué no usar el fallback de headsign del relevamiento:**

- Los datos `tra` están disponibles en el procesamiento offline. No hay caso de "no se conoce `tra`" durante la edición manual de `trips.txt`.
- El fallback ("`lnm.startswith('Centro')` → 0; else → 1") era para el matcheo *runtime* del bridge contra markers AVL que llegaran sin contexto; ahí sí tiene sentido. Acá no aplica.
- Mantener una sola regla simplifica la spec y los tests.

### D-06 — Script de empaquetado: bash de ~10 LOC

**Decisión:** `scripts/build-gtfs-zip.sh` (POSIX bash + `zip` standard), invocable desde docker-compose o local. Toma `data/*.txt` y produce `data/output/gtfs.zip`.

```bash
#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-data/output/gtfs.zip}"
mkdir -p "$(dirname "$OUT")"
( cd data && zip -r "../$OUT" *.txt -x README.md .gitignore )
```

**Por qué bash y no node/python:**

- Es ~5 líneas reales. Cualquier wrapper inflado (`tsc`, `pnpm`, `python -m`) es overkill.
- `zip` está en cualquier imagen base de Docker que vayamos a usar; no agrega dependencia.
- Determinista (mismo input → mismo `.zip` byte-a-byte si fijamos el timestamp, lo cual el spec exige para tests).

### D-07 — Mantenimiento de los `.txt`: edición manual con commit + validación local

**Decisión:** Los `.txt` se editan a mano sobre la base de los CSV de `data/processed/` (infra privada). El flujo recomendado para una actualización:

1. Operador externo (privado) corre el procesamiento y refresca `data/processed/*.csv` (no parte de este repo).
2. Manu copia los valores relevantes a `data/*.txt` en el repo (route names, stops con confianza alta+media, trips templates).
3. Corre `gtfs-kit` localmente (`python -c "import gtfs_kit; ..."` o `scripts/validate-gtfs.sh`) para chequear sintaxis y referencias.
4. Commitea el cambio con mensaje "data: refresh GTFS Schedule from processed CSV YYYY-MM-DD".

**Por qué no auto-import desde processed CSV:**

- Las columnas de `data/processed/*.csv` son específicas del procesamiento privado (`lin`, `sen`, `p1c`...) y NO matchean GTFS Schedule 1-a-1.
- Hay decisiones humanas en la mezcla: aplicar direction_id, generar `trip_id` sintético, omitir stops de baja confianza, escribir `route_long_name` legible, generar `feed_info.feed_version`.
- Un import automático sería un mini-gtfs-builder, justo lo que el PRD excluye.
- La cadencia esperada de updates es baja (semanal/mensual, post-MVP). El costo manual es bajo y la trazabilidad por commit es alta.

### D-08 — Validación canónica en CI vía `npaun/md-gtfs-validator-action@v2`

**Decisión:** Sumar `.github/workflows/validate-gtfs.yml` que corre `npaun/md-gtfs-validator-action@v2` con `md_validator_version: 8.0.1` en cada push/PR que toca `data/**` o el workflow file. Falla el build si el reporte tiene severidad `ERROR`; `WARNING`/`INFO` quedan en el Markdown summary del run sin bloquear.

**Por qué esa Action y no otra:**

- MobilityData **no publica una Action oficial** (verificado: `MobilityData/gtfs-validator-action` no existe). El Canonical Validator solo se distribuye como CLI/Docker/Desktop.
- `npaun/md-gtfs-validator-action` es un wrapper thin sobre el mismo JAR del Canonical Validator; instala Temurin JDK, descarga el JAR, lo corre y parsea el reporte. No reimplementa nada — es exactamente lo que harías a mano en YAML, empaquetado.
- Mantenimiento activo (último push dic-2024); pineamos `@v2` para que un mayor del wrapper no nos rompa el build silenciosamente.
- License no declarado en el repo del wrapper — caveat para un uso comercial estricto, no para un repo open-source con CC-BY-4.0 sobre los datos.

**Por qué Canonical y no `gtfs-kit` u otro:**

- `gtfs-kit` quitó su módulo `validators.py` en v10.0.0 (2024) y el proyecto redirige al Canonical.
- El Canonical es el validador que MobilityData usa internamente para auditar feeds en MobilityDatabase. Si nuestro feed pasa Canonical, pasa MDB.
- Más exhaustivo (checks semánticos, no solo schema).

**Trade-off:** Java arranca en ~30 s; para un feed chico el overhead domina el runtime real. Aceptable — corre en push/PR, no en cada commit.

### D-09 — Release cut: tag `v*.*.*` dispara GitHub Release con `gtfs.zip` adjunto

**Decisión:** Adoptar el patrón "tag-driven release":

1. Branch `release/X.Y.Z` se abre desde `main` para preparar el release (testing manual, validación local, ajustes finales). Es convención humana, sin automation propia.
2. Cuando está OK, se mergea a `main` vía PR.
3. Se pushea el tag `vX.Y.Z` sobre el commit de merge en `main`.
4. El workflow `.github/workflows/release.yml` corre:
   - Build `gtfs.zip` via `scripts/build-gtfs-zip.sh`.
   - Valida con `npaun/md-gtfs-validator-action@v2` (mismo paso que `validate-gtfs.yml`).
   - Crea GitHub Release con `softprops/action-gh-release@v2`, adjuntando `gtfs.zip` como asset.

**URL estable para MobilityDatabase:**

```
https://github.com/manufarfaro/colonia-gtfs/releases/latest/download/gtfs.zip
```

GitHub redirige (302) al asset del último Release. MDB polea esta URL diaria a 00:00 UTC; cuando el `gtfs.zip` cambia, archiva la versión nueva automáticamente. Patrón confirmado en uso por múltiples feeds ya registrados en MDB.

**Por qué tag-driven y no branch-driven:**

- Tags son inmutables; un GitHub Release ancla naturalmente sobre un tag, no sobre un branch.
- El branch `release/X.Y.Z` queda como convención humana para gitflow — sirve para preparar el release con sign-off manual antes de tirar el tag. Sin automation atada, se mantiene simple.
- Trigger único (push de tag) en lugar de manejar branch + tag.

**Versionado:**

- SemVer estricto: `MAJOR.MINOR.PATCH`.
- `v0.0.1` cuando se cumpla el primer criterio de aceptación del PRD §8.
- PATCH: hot-fix de datos (corregir un stop_id mal escrito, etc.).
- MINOR: nueva capability del feed (sumar línea o agencia, soportar fares confirmados, etc.).
- MAJOR: breaking change consumer-facing del GTFS (cambio de esquema de `trip_id`, eliminación de columna).

**Trade-off:** El `release/X.Y.Z` queda como ritual humano sin CI propio. Para un solo dev es perfecto; el día que crezca el equipo, se puede sumar un workflow opcional sobre `release/**` que corra validación previa al merge.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Tarifa Sol Antigua no se confirma antes del demo** → feed expone `price=0` en producción demo | Decisión D-04 + nota en `feed_info.txt`. El demo de v0 está flagueado como cerrado, no público (PRD §8 trigger); la tarifa real solo bloquea release. |
| **Update manual de los `.txt` introduce errores tipográficos / referencias rotas** | `gtfs-kit` corre en CI (`openspec validate` no incluye GTFS-validity; agregamos `scripts/validate-gtfs.sh` como step explícito; el spec `tasks.md` lo lista). |
| **L5 con sub-muestra produce shapes ruidosos en el mapa** | Disclaimer específico (alcance del spec del viewer). El feed expone lo capturado; la UI maneja la presentación. |
| **`srv` se recicla anualmente y rompe el matching del bridge contra histórico** | D-01 desacopla `trip_id` de `srv`; `original_trip_id` se reasocia si `srv` cambia, sin afectar consumidores. |
| **`colonia.osm.pbf` queda desactualizado y OTP rutea sobre calles que ya no existen** | `scripts/refresh-osm.sh` documentado; mantenimiento semestral en el roadmap (issue tracker, no en este spec). |
| **El `gtfs.zip` no es determinista byte-a-byte** (timestamps en el zip) → diffs ruidosos | El script de empaquetado fija el timestamp y orden (`zip -X` y orden alfabético del `find`). El spec lo exige. |

## Migration Plan

No aplica: no existe estado previo. Es la creación inicial del data layer.

Cuando se aplique este change:

1. Crear `openspec/specs/gtfs-static-data/spec.md` desde la versión draft de este change.
2. Inicializar `data/` con los `.txt` (modo placeholder para fares hasta confirmación).
3. Agregar `scripts/build-gtfs-zip.sh` y `scripts/refresh-osm.sh`.
4. Commitear `data/colonia.osm.pbf` generado con el script de refresh.

## Open Questions

Ninguna que bloquee el spec. Quedan tres seguimientos que pertenecen a otros specs:

- **Q4/Q5 del PRD (stack del viewer, librería i18n)** — viven en `viewer-shell-and-i18n`, no acá.
- **Cómo registra OTP los GTFS-RT updaters que sirve el bridge** — vive en `otp-deployment`.
- **Cómo el bridge matchea markers a `trip_id` sintético (D-01)** — vive en `bridge-gtfs-rt`, que debe leer este spec antes de definir su algoritmo.
