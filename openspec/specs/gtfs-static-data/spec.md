## Purpose

La capa de datos GTFS Schedule estáticos para Sol Antigua urbano Colonia del Sacramento. Define los archivos canónicos `data/*.txt`, sus schemas, el modelado de tarifas (incluyendo un modo placeholder mientras la tarifa del operador queda sin confirmar), el grafo OSM peatonal, y el pipeline de bundling + release determinístico del cual dependen los consumidores downstream (OpenTripPlanner, MobilityDatabase, el viewer del trip planner turístico).

## Requirements

### Requirement: The repository SHALL contain a valid GTFS Schedule feed under `data/`

El directorio `data/` SHALL contener todos los archivos GTFS Schedule requeridos para la cobertura de Sol Antigua urbano Colonia en v0: `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`, `shapes.txt`, `feed_info.txt`, `fare_attributes.txt`, `fare_rules.txt`. Todos los archivos SHALL estar codificados en UTF-8 con line endings LF, separados por comas, e incluir un header row. El feed en conjunto SHALL pasar la validación de `gtfs-kit` (Python) sin errores P0 ni P1.

#### Scenario: All required GTFS files exist
- **WHEN** se clona el repositorio y se lista `data/`
- **THEN** los once archivos `.txt` requeridos están presentes en la raíz de `data/`

#### Scenario: Feed passes gtfs-kit validation
- **WHEN** se corre `gtfs-kit` contra el feed (sea contra los `.txt` directos o el `gtfs.zip` bundleado)
- **THEN** la validación completa sin errores P0 ni P1

#### Scenario: Files use UTF-8 with LF line endings
- **WHEN** se lee cualquier archivo `data/*.txt` como bytes
- **THEN** la codificación es UTF-8 válido y el archivo usa terminadores de línea `\n` (no `\r\n`)

### Requirement: The agency SHALL be Sol Antigua, single row, with public contact info

`agency.txt` SHALL contener exactamente una fila representando a Sol Antigua, con los campos requeridos por GTFS `agency_id = sol-antigua`, nombre "Sol Antigua S.A." (o nombre legal vigente), `agency_url = http://www.solantigua.com.uy/`, `agency_timezone = America/Montevideo`. Los campos opcionales pero recomendados `agency_lang = es`, `agency_phone = +598 4522 5505`, y `agency_email = solantigua@montevideo.com.uy` SHALL estar populados para que las consumer apps puedan mostrar la info de contacto del operador.

#### Scenario: Single agency row with required fields
- **WHEN** se inspecciona `agency.txt`
- **THEN** contiene exactamente una fila de datos con `agency_id = sol-antigua` y `agency_timezone = America/Montevideo`

#### Scenario: Operator contact info populated
- **WHEN** se inspecciona `agency.txt`
- **THEN** la fila lleva `agency_phone` y `agency_email` matcheando la info de contacto pública del sitio del operador

### Requirement: Routes SHALL be limited to Sol Antigua urban lines 3, 4, 5, and 8

`routes.txt` SHALL contener exactamente cuatro filas para las líneas urbanas de Sol Antigua observadas en los datos AVL capturados: línea 3, línea 4, línea 5, línea 8. Cada fila SHALL declarar `route_short_name` matcheando el número de línea, un `route_long_name` legible en español, y `route_type = 3` (Bus). El `agency_id` SHALL referenciar `sol-antigua`.

#### Scenario: Exactly four routes are declared
- **WHEN** se inspecciona `routes.txt`
- **THEN** contiene cuatro filas con valores de `route_short_name` {3, 4, 5, 8} y ninguna otra ruta

### Requirement: Trip IDs SHALL be synthetic and decoupled from operator identifiers

`trips.txt` SHALL declarar valores de `trip_id` en el formato `{route_id}-{service_id}-{direction_id}-{HHMM}` (ej. `4-weekday-0-0830`). El identificador de trip original del operador (`srv` en el feed AVL) SHALL preservarse en una columna no estándar llamada `original_trip_id`. Cada `trip_id` sintético SHALL ser único dentro del feed.

#### Scenario: trip_id follows the synthetic format
- **WHEN** se inspecciona cualquier fila de `trips.txt`
- **THEN** su `trip_id` matchea el patrón `[345|8]-[weekday|saturday|sunday|holiday]-[01]-[0-9]{4}`

#### Scenario: original_trip_id preserves operator's srv
- **WHEN** se inspecciona `trips.txt`
- **THEN** cada fila tiene un `original_trip_id` no vacío que lleva el valor `srv` correspondiente del feed AVL del operador

#### Scenario: Synthetic trip_ids are unique
- **WHEN** se colectan todos los valores de `trip_id` de `trips.txt`
- **THEN** ningún valor aparece más de una vez

### Requirement: `direction_id` SHALL be derived deterministically from the operator's `tra`

Para cada trip, `direction_id = 1` SHALL ser asignado cuando el trip corresponde a `tra = 1` (outbound) en el feed AVL, y `direction_id = 0` SHALL ser asignado cuando el trip corresponde a `tra ∈ {2, 4}` (inbound, hacia Centro).

#### Scenario: Outbound trips have direction_id = 1
- **WHEN** un trip en `trips.txt` está asociado a un headsign que contiene "El General" o que se originó de `tra = 1` en los datos fuente
- **THEN** su `direction_id` es `1`

#### Scenario: Inbound trips have direction_id = 0
- **WHEN** un trip en `trips.txt` está asociado a un headsign que empieza con "Centro" o que se originó de `tra ∈ {2, 4}` en los datos fuente
- **THEN** su `direction_id` es `0`

### Requirement: Line 5 SHALL be modeled as one route with three distinct shapes

La línea 5 tiene tres variantes operativas en los datos AVL (`tra` con valores 1, 2 y 4) correspondientes a itinerarios físicos distintos. `routes.txt` SHALL contener una sola fila para `route_id = 5`, y `shapes.txt` SHALL contener tres valores distintos de `shape_id` asociados a la línea 5: `5-out-r1`, `5-in-r1`, `5-in-direct`. `trips.txt` SHALL asociar cada trip de línea 5 con el `shape_id` correspondiente.

#### Scenario: Single L5 row in routes.txt
- **WHEN** `routes.txt` se filtra a `route_short_name = "5"`
- **THEN** se devuelve exactamente una fila

#### Scenario: Three L5 shape_ids in shapes.txt
- **WHEN** se colectan los valores distintos de `shape_id` asociados a trips de línea 5
- **THEN** el conjunto es igual a `{5-out-r1, 5-in-r1, 5-in-direct}`

#### Scenario: Every L5 trip references one of the three shapes
- **WHEN** se inspeccionan los trips para `route_id = 5`
- **THEN** el `shape_id` de cada trip es uno de `{5-out-r1, 5-in-r1, 5-in-direct}`

### Requirement: Stops SHALL include only entries with high or medium capture confidence

`stops.txt` SHALL contener solo los stops clasificados como confianza `alta` o `media` en el output de procesamiento privado (`data/processed/stops.csv`). Los stops de baja confianza SHALL estar excluidos. Cada `stop_id` referenciado por `stop_times.txt` SHALL existir en `stops.txt`.

#### Scenario: Low-confidence stops are absent
- **WHEN** se compara `stops.txt` contra el fuente `data/processed/stops.csv` y se identifican los stops con `confidence = baja`
- **THEN** ninguno de esos `stop_id` de baja confianza aparece en `stops.txt`

#### Scenario: stop_times referential integrity holds
- **WHEN** se colectan todos los valores de `stop_id` referenciados desde `stop_times.txt`
- **THEN** cada valor existe en `stops.txt`

### Requirement: Calendar SHALL declare four service types covering Uruguay 2026 holidays

`calendar.txt` SHALL declarar exactamente cuatro valores de `service_id`: `weekday`, `saturday`, `sunday`, `holiday`. `calendar_dates.txt` SHALL incluir las fechas de feriados públicos uruguayos 2026 como excepciones asignando el service `holiday`.

#### Scenario: Four service_ids
- **WHEN** se inspecciona `calendar.txt`
- **THEN** contiene exactamente cuatro filas con valores de `service_id` `{weekday, saturday, sunday, holiday}`

#### Scenario: UY 2026 holidays present in calendar_dates
- **WHEN** se inspecciona `calendar_dates.txt` y se enumeran los feriados públicos uruguayos 2026
- **THEN** cada fecha de feriado aparece como una fila con `exception_type = 1` referenciando `service_id = holiday`

### Requirement: Fares SHALL support an explicit placeholder mode while the tariff is unconfirmed

El feed SHALL declarar tarifas en `fare_attributes.txt` y `fare_rules.txt` según GTFS Schedule. Hasta que la tarifa canónica se confirme con Sol Antigua, el feed SHALL usar un modo placeholder con una sola fila de tarifa cuyos campos son `fare_id = standard-pending`, `price = 0.00`, `currency_type = UYU`, `payment_method = 0`, `transfers = 0`. Una vez confirmada la tarifa, el feed SHALL reemplazarla por una fila `fare_id = standard` con el precio confirmado en UYU.

#### Scenario: Placeholder mode declares zero-priced fare
- **WHEN** la tarifa no ha sido confirmada y se inspecciona `fare_attributes.txt`
- **THEN** el archivo contiene exactamente una fila de tarifa con `fare_id = standard-pending`, `price = 0.00`, `currency_type = UYU`, `payment_method = 0`, `transfers = 0`

#### Scenario: Confirmed mode declares the real tariff
- **WHEN** la tarifa ha sido confirmada y se inspecciona `fare_attributes.txt`
- **THEN** el archivo contiene una fila de tarifa con `fare_id = standard`, `price > 0`, `currency_type = UYU`

#### Scenario: feed_info.txt flags placeholder mode
- **WHEN** el feed está en modo placeholder
- **THEN** `feed_info.txt` incluye una nota a nivel feed comunicando que las tarifas son preliminares

### Requirement: The OSM walking graph SHALL be committed at `data/colonia.osm.pbf`

El repositorio SHALL contener `data/colonia.osm.pbf`, un extract de OpenStreetMap de Colonia urbano cubriendo Real de San Carlos hasta Algodones (bbox aproximado `-57.92,-34.51` a `-57.78,-34.42`). Un script `tooling/scripts/refresh_osm.py` SHALL regenerar el archivo desde Geofabrik Uruguay on-demand (vía `osmium-tool` para el clip del bbox).

#### Scenario: OSM extract is committed
- **WHEN** se clona el repositorio
- **THEN** `data/colonia.osm.pbf` está presente y no vacío

#### Scenario: Refresh script exists and is documented
- **WHEN** se invoca `uv run --directory tooling python scripts/refresh_osm.py` sin argumentos
- **THEN** regenera `data/colonia.osm.pbf` desde el source Geofabrik UY clipeado al bbox documentado (o falla con un mensaje claro si falta `osmium-tool` en PATH)

### Requirement: A bundling script SHALL produce a deterministic `gtfs.zip`

`tooling/scripts/build_gtfs_zip.py` SHALL empaquetar todos los archivos `data/*.txt` en un archivo `gtfs.zip` apto para ser mounteado en OpenTripPlanner. El script SHALL aceptar un argumento opcional de path de output (default `data/output/gtfs.zip` relativo a la raíz del repo). Correr el script dos veces sobre el mismo input SHALL producir output byte-idéntico (orden determinístico y timestamps fijos, independientemente de los mtimes de los archivos fuente).

#### Scenario: gtfs.zip contains all required files
- **WHEN** se invoca `uv run --directory tooling python scripts/build_gtfs_zip.py` y se lista el archivo resultante
- **THEN** contiene los once archivos `.txt` canónicos de GTFS Schedule en la raíz del archive, y ningún otro archivo

#### Scenario: Output path defaults to data/output/gtfs.zip
- **WHEN** se invoca el script sin argumentos
- **THEN** el output se escribe en `data/output/gtfs.zip` (relativo al working directory actual)

#### Scenario: Output is byte-deterministic
- **WHEN** se invoca el script dos veces seguidas con input inalterado (o incluso con los archivos `.txt` fuente "touch"-eados entre runs)
- **THEN** el SHA-256 del `gtfs.zip` resultante es idéntico entre las dos corridas

### Requirement: Static data updates SHALL be performed manually and tracked in version control

Los archivos `.txt` en `data/` SHALL ser editados a mano desde los CSVs fuente del repo privado de procesamiento (`data/processed/*.csv` y `shapes.geojson`, que no son parte de este repositorio). Ningún script en este repositorio SHALL autogenerar los `.txt` desde capturas AVL crudas. Cada update SHALL aterrizar vía un commit que referencie la fecha del CSV procesado fuente en su mensaje.

#### Scenario: No autogeneration script exists in the repo
- **WHEN** se inspecciona el directorio de scripts del repositorio
- **THEN** ningún script lee de `data/avl-log/` (que no existe en este repo) ni genera `data/*.txt` a partir de datos AVL crudos

#### Scenario: Data refresh commits reference the source CSV date
- **WHEN** se inspecciona un commit de refresh de `data/`
- **THEN** el mensaje del commit nombra la fecha del CSV procesado fuente en formato `YYYY-MM-DD`

### Requirement: The static feed SHALL be validated against the MobilityData Canonical GTFS Validator in CI

Un workflow de GitHub Actions SHALL correr el MobilityData Canonical GTFS Validator contra el `gtfs.zip` bundleado en cada push o pull request que toque `data/**` o el archivo de workflow de validación. La versión del validator SHALL estar pineada (`8.0.1` al momento de escritura; los bumps requieren un PR explícito). El workflow SHALL fallar el build ante cualquier notice con severity `ERROR`. Los notices `WARNING` e `INFO` SHALL ser surface-ados en el Markdown summary de la run pero SHALL NOT fallar el build.

#### Scenario: Validation runs on PRs touching data
- **WHEN** un pull request modifica cualquier archivo bajo `data/**`
- **THEN** el workflow de validación GTFS corre y postea un Markdown summary a la run

#### Scenario: ERROR-severity notices fail the build
- **WHEN** el Canonical Validator emite al menos un notice con severity `ERROR`
- **THEN** el workflow sale con un status code no-cero

#### Scenario: WARNING and INFO notices do not fail the build
- **WHEN** el Canonical Validator emite solo notices con severity `WARNING` o `INFO`
- **THEN** el workflow sale con status code `0`, y los notices aparecen en el run summary

### Requirement: Merging a `release/X.Y.Z` PR SHALL publish `gtfs.zip` as a GitHub Release asset

Un workflow de GitHub Actions SHALL correr cuando un pull request desde un branch matcheando `release/*` se mergee a `main`. El workflow SHALL extraer la versión del head ref (`release/X.Y.Z` → `vX.Y.Z`), construir `gtfs.zip` vía `tooling/scripts/build_gtfs_zip.py`, validarlo con el MobilityData Canonical Validator, y en caso de éxito crear el tag `vX.Y.Z` (apuntando al merge commit en `main`) y un GitHub Release nombrado como el tag con `gtfs.zip` adjunto como release asset. El asset SHALL quedar retrievable en la URL estable `https://github.com/<owner>/<repo>/releases/latest/download/gtfs.zip` de modo que MobilityDatabase y otros consumidores downstream puedan pollear una sola URL.

El mismo workflow SHALL también soportar un trigger `workflow_dispatch` que tome un input `version`, de modo que un release se pueda re-publicar manualmente sin abrir un nuevo PR `release/X.Y.Z` (ej. después de una falla transitoria del validator).

El proceso humano de "cortar release" — abrir un branch `release/X.Y.Z` desde `main`, validar local, mergear a `main` — SHALL estar documentado en `docs/release-process.md`. Ningún paso manual de `git tag` / `git push origin v*.*.*` es requerido.

#### Scenario: Merge of a release/X.Y.Z PR creates a GitHub Release with the asset
- **WHEN** un pull request desde un branch `release/X.Y.Z` se mergea a `main`
- **THEN** el workflow crea el tag `vX.Y.Z` y un GitHub Release nombrado `vX.Y.Z` con `gtfs.zip` adjunto como asset

#### Scenario: Release build fails on validation errors
- **WHEN** el workflow de release corre y el Canonical Validator emite cualquier notice con severity ERROR sobre el `gtfs.zip` bundleado
- **THEN** ni el tag ni el GitHub Release se crean, y el workflow sale no-cero

#### Scenario: Manual workflow_dispatch with a version input re-publishes a release
- **WHEN** el workflow es disparado manualmente con `version: X.Y.Z`
- **THEN** el workflow produce los mismos outputs que el path de merge de PR para esa versión (tag `vX.Y.Z` y un GitHub Release correspondiente)

#### Scenario: The "latest" URL serves the most recent release
- **WHEN** se fetchea la URL `https://github.com/<owner>/<repo>/releases/latest/download/gtfs.zip` después de que al menos un release `v*.*.*` haya sido publicado
- **THEN** la respuesta es un redirect 302 al asset del release más reciente, y el asset es el `gtfs.zip` producido por el run de workflow de ese release

#### Scenario: Release process is documented
- **WHEN** se inspecciona el repositorio
- **THEN** `docs/release-process.md` existe y describe el flow `release/X.Y.Z` → merge → tag
