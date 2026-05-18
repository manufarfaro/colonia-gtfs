## 1. Repo scaffolding

- [ ] 1.1 Create `data/` directory with empty placeholders for the eleven GTFS `.txt` files
- [ ] 1.2 Add `data/README.md` documenting the manual-update contract (D-07: edit by hand, source from private `data/processed/*.csv`, commit message references CSV date)
- [ ] 1.3 Add `data/.gitignore` excluding `data/output/` (build artifacts)
- [ ] 1.4 Create `scripts/` directory if it does not exist

## 2. Build and refresh scripts

- [ ] 2.1 Write `scripts/build-gtfs-zip.sh` — packages `data/*.txt` into `data/output/gtfs.zip`, deterministic (fixed file timestamps via `zip -X`, alphabetical order), optional output path argument
- [ ] 2.2 Add a Node-free smoke test inline in the script header (sha256 comparison against a second invocation) or as `scripts/test-build-deterministic.sh`
- [ ] 2.3 Write `scripts/refresh-osm.sh` — downloads `uruguay-latest.osm.pbf` from Geofabrik, clips by the documented bbox `-57.92,-34.51,-57.78,-34.42` using `osmium-tool`, writes `data/colonia.osm.pbf`. Document `osmium-tool` install in the script header
- [ ] 2.4 Write `scripts/validate-gtfs.sh` — invokes `gtfs-kit` via Python to validate the feed (`.txt` files or `gtfs.zip`); exits non-zero on P0/P1 errors

## 3. OSM walking graph

- [ ] 3.1 Run `scripts/refresh-osm.sh` locally to produce `data/colonia.osm.pbf`
- [ ] 3.2 Verify the bbox covers Real de San Carlos (north end of L3) and Algodones (south end of L8)
- [ ] 3.3 Commit the binary `data/colonia.osm.pbf` to the repo

## 4. Author structural GTFS files

- [ ] 4.1 Author `data/agency.txt` — single row, Sol Antigua, `America/Montevideo`, `agency_lang = es`, `agency_phone = "+598 4522 5505"`, `agency_email = solantigua@montevideo.com.uy`
- [ ] 4.2 Author `data/feed_info.txt` — publisher, version, valid date range, and a `feed_contact_email` if desired; include placeholder-mode note while fares are unconfirmed
- [ ] 4.3 Author `data/calendar.txt` — exactly four service_ids: `weekday`, `saturday`, `sunday`, `holiday`, each with the appropriate weekday flags and a `start_date`/`end_date` covering v0
- [ ] 4.4 Author `data/calendar_dates.txt` — Uruguay 2026 public holidays as exceptions assigning the `holiday` service (source the list from `process_avl_log.py` URUGUAY_HOLIDAYS)

## 5. Author routes, stops, shapes

- [ ] 5.1 Author `data/routes.txt` — four rows for lines 3, 4, 5, 8; `route_short_name = lin`, `route_long_name` in Spanish (derive from the dominant `lnm` for each line), `route_type = 3`, `agency_id = sol-antigua`. Optional: `route_color`
- [ ] 5.2 Author `data/stops.txt` — filter `data/processed/stops.csv` to `confidence ∈ {alta, media}` (130 stops), map `p1c → stop_id`, `p1n → stop_name`, `lat_mean → stop_lat`, `lon_mean → stop_lon`
- [ ] 5.3 Build shape geometries for L3, L4, L8 (two shapes each: outbound and inbound) from `data/processed/shapes.geojson`; simplify if necessary to keep `shapes.txt` reasonable
- [ ] 5.4 Build the three L5 shape geometries (`5-out-r1`, `5-in-r1`, `5-in-direct`) from `data/processed/shapes.geojson`; accept noisier output given sparse capture (per D-02)
- [ ] 5.5 Author `data/shapes.txt` — emit `shape_id`, `shape_pt_lat`, `shape_pt_lon`, `shape_pt_sequence` for each of the 11 shapes (8 for L3/L4/L8 + 3 for L5)

## 6. Author trips and stop_times

- [ ] 6.1 For each row in `data/processed/trips.csv`, derive `direction_id` from the source `tra` value (1 → 1; {2, 4} → 0) and the synthetic `trip_id = {route_id}-{service_id}-{direction_id}-{HHMM}`
- [ ] 6.2 Author `data/trips.txt` with columns `route_id, service_id, trip_id, trip_headsign, direction_id, shape_id, original_trip_id`. Verify uniqueness of synthetic `trip_id` values
- [ ] 6.3 Generate `data/stop_times.txt` by applying the inference algorithm from the relevamiento §7 (group markers per trip instance, walk through `p1c` transitions, compute median offsets per template). Source values from `data/processed/` (private, not in this repo); the deliverable here is only the final `.txt`
- [ ] 6.4 Verify referential integrity: every `stop_id` in `stop_times.txt` exists in `stops.txt`; every `trip_id` exists in `trips.txt`

## 7. Author fares (placeholder mode)

- [ ] 7.1 Author `data/fare_attributes.txt` in **placeholder mode**: single row with `fare_id = standard-pending`, `price = 0.00`, `currency_type = UYU`, `payment_method = 0`, `transfers = 0`
- [ ] 7.2 Author `data/fare_rules.txt` — one row per route (3, 4, 5, 8) referencing `fare_id = standard-pending`
- [ ] 7.3 Document in `data/README.md` how to flip to confirmed mode (one fare row change + edit `feed_info.txt` note)

## 8. Validate

- [ ] 8.1 Run `scripts/build-gtfs-zip.sh` and confirm `data/output/gtfs.zip` is produced
- [ ] 8.2 Run `scripts/build-gtfs-zip.sh` twice and confirm SHA-256 of the two outputs is identical (determinism check)
- [ ] 8.3 Run `scripts/validate-gtfs.sh` against `data/output/gtfs.zip`; resolve any P0 or P1 errors reported by `gtfs-kit`
- [ ] 8.4 Run `openspec validate --all --strict --no-interactive` and confirm green

## 9. Documentation

- [ ] 9.1 Update repo `README.md` with a short "Data layer" section pointing to `data/README.md` and the build script
- [ ] 9.2 Update repo `README.en.md` mirror
- [ ] 9.3 Confirm `CLAUDE.md` "Product guardrails" already covers the data-in-`data/` and no-builder constraints (no changes needed unless a new constraint appears here)

## 10. Acceptance smoke test (sanity check, full OTP integration is in `otp-deployment`)

- [ ] 10.1 Spot-check the bundle by loading `data/output/gtfs.zip` with `gtfs-kit.read_feed()` in a one-off Python session; confirm read succeeds and `feed.routes` returns four rows
- [ ] 10.2 Eyeball the L5 shapes on https://geojson.io or `data/processed/shapes_map.html` and confirm they look plausible given the sparse-data disclaimer is documented (PRD §3.2)

## 11. CI: validación GTFS contra el Canonical Validator

- [ ] 11.1 Create `.github/workflows/validate-gtfs.yml` with triggers `on: push: paths: ["data/**", ".github/workflows/validate-gtfs.yml"]` and the equivalent `pull_request`
- [ ] 11.2 Job step: `actions/checkout@v4`
- [ ] 11.3 Job step: run `scripts/build-gtfs-zip.sh` so the workflow has a `data/output/gtfs.zip` to validate
- [ ] 11.4 Job step: `uses: npaun/md-gtfs-validator-action@v2` with `gtfs_path: data/output/gtfs.zip`, `md_validator_version: "8.0.1"`, `java_version: "21"`. Confirm the action fails the build on ERROR-severity notices and posts the report to `$GITHUB_STEP_SUMMARY`
- [ ] 11.5 Locally smoke-test the workflow with `act` or a draft PR — confirm the run summary surfaces WARNING/INFO notices without failing
- [ ] 11.6 Add a status badge for `validate-gtfs.yml` to the README (alongside the existing OpenSpec one)

## 12. Release cut: tag-driven GitHub Release

- [ ] 12.1 Create `.github/workflows/release.yml` with trigger `on: push: tags: ["v*.*.*"]`
- [ ] 12.2 Job step: checkout
- [ ] 12.3 Job step: run `scripts/build-gtfs-zip.sh` to produce `data/output/gtfs.zip`
- [ ] 12.4 Job step: validate via `npaun/md-gtfs-validator-action@v2` (same pin as §11.4); fail the workflow on ERROR notices
- [ ] 12.5 Job step: `softprops/action-gh-release@v2` — create a Release named after the pushed tag, attach `data/output/gtfs.zip` as a release asset, body autogenerated from `gh release create --generate-notes` (or equivalent)
- [ ] 12.6 Write `docs/release-process.md` describing the human flow: open `release/X.Y.Z` from main → validate locally → merge PR to main → push tag `vX.Y.Z` on the merge commit. Include the SemVer policy (D-09)
- [ ] 12.7 Tag a smoke-test `v0.0.0-rc.1` (or similar) after the first feed lands; verify the workflow creates a Release and that `https://github.com/manufarfaro/colonia-gtfs/releases/latest/download/gtfs.zip` redirects (302) to the new asset
- [ ] 12.8 Once `v0.0.1` ships, prepare the MobilityDatabase submission (out of scope for this change, tracked in PRD §10.2 L3) using the stable "latest" URL
