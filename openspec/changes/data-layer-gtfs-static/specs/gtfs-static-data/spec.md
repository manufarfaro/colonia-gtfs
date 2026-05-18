## ADDED Requirements

### Requirement: The repository SHALL contain a valid GTFS Schedule feed under `data/`

The `data/` directory SHALL contain all GTFS Schedule files required for Sol Antigua urban Colonia coverage in v0: `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`, `shapes.txt`, `feed_info.txt`, `fare_attributes.txt`, `fare_rules.txt`. All files SHALL be UTF-8 encoded with LF line endings, comma-separated, and include a header row. The feed as a whole SHALL pass `gtfs-kit` validation (Python) without P0 or P1 errors.

#### Scenario: All required GTFS files exist
- **WHEN** the repository is cloned and `data/` is listed
- **THEN** the eleven required `.txt` files are present at the top of `data/`

#### Scenario: Feed passes gtfs-kit validation
- **WHEN** `gtfs-kit` is run against the feed (either against the `.txt` files directly or the bundled `gtfs.zip`)
- **THEN** the validation completes without P0 or P1 errors

#### Scenario: Files use UTF-8 with LF line endings
- **WHEN** any `data/*.txt` file is read as bytes
- **THEN** the encoding is valid UTF-8 and the file uses `\n` line terminators (no `\r\n`)

### Requirement: The agency SHALL be Sol Antigua, single row, with public contact info

`agency.txt` SHALL contain exactly one row representing Sol Antigua, with the GTFS-required fields `agency_id = sol-antigua`, name "Sol Antigua S.A." (or current legal name), `agency_url = http://www.solantigua.com.uy/`, `agency_timezone = America/Montevideo`. The optional but recommended fields `agency_lang = es`, `agency_phone = +598 4522 5505`, and `agency_email = solantigua@montevideo.com.uy` SHALL be populated so consumer apps can surface operator contact info.

#### Scenario: Single agency row with required fields
- **WHEN** `agency.txt` is inspected
- **THEN** it contains exactly one data row with `agency_id = sol-antigua` and `agency_timezone = America/Montevideo`

#### Scenario: Operator contact info populated
- **WHEN** `agency.txt` is inspected
- **THEN** the row carries `agency_phone` and `agency_email` matching the public contact info from the operator's website

### Requirement: Routes SHALL be limited to Sol Antigua urban lines 3, 4, 5, and 8

`routes.txt` SHALL contain exactly four rows for the urban lines of Sol Antigua observed in the captured AVL data: line 3, line 4, line 5, line 8. Each row SHALL declare `route_short_name` matching the line number, a human-readable `route_long_name` in Spanish, and `route_type = 3` (Bus). The `agency_id` SHALL reference `sol-antigua`.

#### Scenario: Exactly four routes are declared
- **WHEN** `routes.txt` is inspected
- **THEN** it contains four rows with `route_short_name` values {3, 4, 5, 8} and no other routes

### Requirement: Trip IDs SHALL be synthetic and decoupled from operator identifiers

`trips.txt` SHALL declare `trip_id` values in the format `{route_id}-{service_id}-{direction_id}-{HHMM}` (e.g. `4-weekday-0-0830`). The operator's original trip identifier (`srv` in the AVL feed) SHALL be preserved in a non-standard column named `original_trip_id`. Every synthetic `trip_id` SHALL be unique within the feed.

#### Scenario: trip_id follows the synthetic format
- **WHEN** any row of `trips.txt` is inspected
- **THEN** its `trip_id` matches the pattern `[345|8]-[weekday|saturday|sunday|holiday]-[01]-[0-9]{4}`

#### Scenario: original_trip_id preserves operator's srv
- **WHEN** `trips.txt` is inspected
- **THEN** every row has a non-empty `original_trip_id` carrying the corresponding `srv` value from the operator's AVL feed

#### Scenario: Synthetic trip_ids are unique
- **WHEN** all `trip_id` values are collected from `trips.txt`
- **THEN** no value appears more than once

### Requirement: `direction_id` SHALL be derived deterministically from the operator's `tra`

For every trip, `direction_id = 1` SHALL be assigned when the trip corresponds to `tra = 1` (outbound) in the AVL feed, and `direction_id = 0` SHALL be assigned when the trip corresponds to `tra ∈ {2, 4}` (inbound, hacia Centro).

#### Scenario: Outbound trips have direction_id = 1
- **WHEN** a trip in `trips.txt` is associated with a headsign containing "El General" or otherwise originated from `tra = 1` in the source data
- **THEN** its `direction_id` is `1`

#### Scenario: Inbound trips have direction_id = 0
- **WHEN** a trip in `trips.txt` is associated with a headsign starting with "Centro" or otherwise originated from `tra ∈ {2, 4}` in the source data
- **THEN** its `direction_id` is `0`

### Requirement: Line 5 SHALL be modeled as one route with three distinct shapes

Line 5 has three operational variants in the AVL data (`tra` values 1, 2, and 4) corresponding to different physical itineraries. `routes.txt` SHALL contain a single row for `route_id = 5`, and `shapes.txt` SHALL contain three distinct `shape_id` values associated with line 5: `5-out-r1`, `5-in-r1`, `5-in-direct`. `trips.txt` SHALL associate every line-5 trip with the corresponding `shape_id`.

#### Scenario: Single L5 row in routes.txt
- **WHEN** `routes.txt` is filtered to `route_short_name = "5"`
- **THEN** exactly one row is returned

#### Scenario: Three L5 shape_ids in shapes.txt
- **WHEN** distinct `shape_id` values associated with line-5 trips are collected
- **THEN** the set equals `{5-out-r1, 5-in-r1, 5-in-direct}`

#### Scenario: Every L5 trip references one of the three shapes
- **WHEN** trips for `route_id = 5` are inspected
- **THEN** each trip's `shape_id` is one of `{5-out-r1, 5-in-r1, 5-in-direct}`

### Requirement: Stops SHALL include only entries with high or medium capture confidence

`stops.txt` SHALL contain only the stops classified as `alta` or `media` confidence in the private processing output (`data/processed/stops.csv`). Low-confidence stops SHALL be excluded. Every `stop_id` referenced by `stop_times.txt` SHALL exist in `stops.txt`.

#### Scenario: Low-confidence stops are absent
- **WHEN** `stops.txt` is compared against the source `data/processed/stops.csv` and stops with `confidence = baja` are identified
- **THEN** none of those low-confidence `stop_id` values appears in `stops.txt`

#### Scenario: stop_times referential integrity holds
- **WHEN** all `stop_id` values referenced from `stop_times.txt` are collected
- **THEN** every value exists in `stops.txt`

### Requirement: Calendar SHALL declare four service types covering Uruguay 2026 holidays

`calendar.txt` SHALL declare exactly four `service_id` values: `weekday`, `saturday`, `sunday`, `holiday`. `calendar_dates.txt` SHALL include the Uruguay 2026 public-holiday dates as exceptions assigning the `holiday` service.

#### Scenario: Four service_ids
- **WHEN** `calendar.txt` is inspected
- **THEN** it contains exactly four rows with `service_id` values `{weekday, saturday, sunday, holiday}`

#### Scenario: UY 2026 holidays present in calendar_dates
- **WHEN** `calendar_dates.txt` is inspected and Uruguay 2026 public holidays are enumerated
- **THEN** each holiday date appears as a row with `exception_type = 1` referencing `service_id = holiday`

### Requirement: Fares SHALL support an explicit placeholder mode while the tariff is unconfirmed

The feed SHALL declare fares in `fare_attributes.txt` and `fare_rules.txt` per GTFS Schedule. Until the canonical tariff is confirmed with Sol Antigua, the feed SHALL use a placeholder mode with a single fare row whose `fare_id = standard-pending`, `price = 0.00`, `currency_type = UYU`, `payment_method = 0`, `transfers = 0`. Once the tariff is confirmed, the feed SHALL replace it with a `fare_id = standard` row carrying the confirmed price in UYU.

#### Scenario: Placeholder mode declares zero-priced fare
- **WHEN** the tariff has not been confirmed and `fare_attributes.txt` is inspected
- **THEN** the file contains exactly one fare row with `fare_id = standard-pending`, `price = 0.00`, `currency_type = UYU`, `payment_method = 0`, `transfers = 0`

#### Scenario: Confirmed mode declares the real tariff
- **WHEN** the tariff has been confirmed and `fare_attributes.txt` is inspected
- **THEN** the file contains a fare row with `fare_id = standard`, `price > 0`, `currency_type = UYU`

#### Scenario: feed_info.txt flags placeholder mode
- **WHEN** the feed is in placeholder mode
- **THEN** `feed_info.txt` includes a feed-level note communicating that tariffs are preliminary

### Requirement: The OSM walking graph SHALL be committed at `data/colonia.osm.pbf`

The repository SHALL contain `data/colonia.osm.pbf`, an OpenStreetMap extract of Colonia urbano covering Real de San Carlos to Algodones (approximate bbox `-57.92,-34.51` to `-57.78,-34.42`). A `scripts/refresh-osm.sh` script SHALL document how to regenerate the file deterministically from Geofabrik Uruguay.

#### Scenario: OSM extract is committed
- **WHEN** the repository is cloned
- **THEN** `data/colonia.osm.pbf` is present and non-empty

#### Scenario: Refresh script exists and is documented
- **WHEN** `scripts/refresh-osm.sh` is invoked with no arguments
- **THEN** it prints usage or regenerates `data/colonia.osm.pbf` from the Geofabrik UY source clipped to the documented bbox

### Requirement: A bundling script SHALL produce a deterministic `gtfs.zip`

`scripts/build-gtfs-zip.sh` SHALL package all `data/*.txt` files into a `gtfs.zip` archive suitable for mounting in OpenTripPlanner. The script SHALL accept an optional output path argument (default `data/output/gtfs.zip`). Running the script twice on the same input SHALL produce byte-identical output (deterministic ordering and fixed timestamps).

#### Scenario: gtfs.zip contains all required files
- **WHEN** `scripts/build-gtfs-zip.sh` is invoked and the resulting archive is listed
- **THEN** it contains the eleven canonical GTFS Schedule `.txt` files at the archive root, and no other files

#### Scenario: Output path defaults to data/output/gtfs.zip
- **WHEN** the script is invoked with no arguments
- **THEN** the output is written to `data/output/gtfs.zip`

#### Scenario: Output is byte-deterministic
- **WHEN** the script is invoked twice in succession on unchanged input
- **THEN** the SHA-256 of the resulting `gtfs.zip` is identical across the two runs

### Requirement: Static data updates SHALL be performed manually and tracked in version control

The `.txt` files in `data/` SHALL be edited by hand from the source CSVs in the private processing repo (`data/processed/*.csv` and `shapes.geojson`, which are not part of this repository). No script in this repository SHALL autogenerate the `.txt` files from raw AVL captures. Every update SHALL land via a commit referencing the source processed CSV date in its message.

#### Scenario: No autogeneration script exists in the repo
- **WHEN** the repository scripts directory is inspected
- **THEN** no script reads from `data/avl-log/` (which does not exist in this repo) or generates `data/*.txt` from raw AVL data

#### Scenario: Data refresh commits reference the source CSV date
- **WHEN** a `data/` refresh commit is inspected
- **THEN** the commit message names the source processed-CSV date in `YYYY-MM-DD` form

### Requirement: The static feed SHALL be validated against the MobilityData Canonical GTFS Validator in CI

A GitHub Actions workflow SHALL run the MobilityData Canonical GTFS Validator against the bundled `gtfs.zip` on every push or pull request that touches `data/**` or the validation workflow file. The validator version SHALL be pinned (`8.0.1` at time of writing; bumps require an explicit PR). The workflow SHALL fail the build on any notice with `ERROR` severity. `WARNING` and `INFO` notices SHALL be surfaced in the run's Markdown summary but SHALL NOT fail the build.

#### Scenario: Validation runs on PRs touching data
- **WHEN** a pull request modifies any file under `data/**`
- **THEN** the GTFS validation workflow runs and posts a Markdown summary to the run

#### Scenario: ERROR-severity notices fail the build
- **WHEN** the Canonical Validator emits at least one notice with severity `ERROR`
- **THEN** the workflow exits with a non-zero status code

#### Scenario: WARNING and INFO notices do not fail the build
- **WHEN** the Canonical Validator emits only notices with severity `WARNING` or `INFO`
- **THEN** the workflow exits with status code `0`, and the notices appear in the run summary

### Requirement: Tagged versions SHALL publish `gtfs.zip` as a GitHub Release asset

A GitHub Actions workflow SHALL run on the push of a tag matching `v*.*.*` against the default branch. The workflow SHALL build `gtfs.zip` via `scripts/build-gtfs-zip.sh`, validate it with the MobilityData Canonical Validator, and on success create a GitHub Release named after the tag with `gtfs.zip` attached as a release asset. The asset SHALL remain retrievable at the stable URL `https://github.com/<owner>/<repo>/releases/latest/download/gtfs.zip` so that MobilityDatabase and other downstream consumers can poll a single URL.

The human "release cut" process — opening a `release/X.Y.Z` branch from `main`, validating locally, merging to `main`, then pushing the tag — SHALL be documented in `docs/release-process.md`.

#### Scenario: Tag push creates a GitHub Release with the asset
- **WHEN** a tag matching `v*.*.*` is pushed to the repository
- **THEN** a GitHub Release named after the tag is created with `gtfs.zip` attached as an asset

#### Scenario: Release build fails on validation errors
- **WHEN** the release workflow runs and the Canonical Validator emits any ERROR-severity notice on the bundled `gtfs.zip`
- **THEN** the GitHub Release is not created and the workflow exits non-zero

#### Scenario: The "latest" URL serves the most recent release
- **WHEN** the URL `https://github.com/<owner>/<repo>/releases/latest/download/gtfs.zip` is fetched after at least one `v*.*.*` release has been published
- **THEN** the response is a 302 redirect to the asset of the most recent release, and the asset is the `gtfs.zip` produced by that release's workflow run

#### Scenario: Release process is documented
- **WHEN** the repository is inspected
- **THEN** `docs/release-process.md` exists and describes the `release/X.Y.Z` → merge → tag flow
