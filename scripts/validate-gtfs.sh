#!/usr/bin/env bash
#
# validate-gtfs.sh — Local sanity check of the static GTFS feed using
# gtfs-kit (Python). This is a lightweight pre-push check; the
# authoritative validation in CI uses the MobilityData Canonical
# Validator (see .github/workflows/validate-gtfs.yml).
#
# Required tooling:
#   - python3
#   - gtfs-kit: pip3 install gtfs-kit

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP_PATH="${1:-$ROOT/data/output/gtfs.zip}"

if ! command -v python3 > /dev/null; then
  echo "error: python3 not installed" >&2
  exit 1
fi

if ! python3 -c 'import gtfs_kit' > /dev/null 2>&1; then
  echo "error: gtfs-kit not installed in the active python3 environment" >&2
  echo "       install with: pip3 install gtfs-kit" >&2
  exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "error: $ZIP_PATH does not exist" >&2
  echo "       run scripts/build-gtfs-zip.sh first" >&2
  exit 1
fi

python3 - "$ZIP_PATH" <<'PY'
import sys
import gtfs_kit as gk

zip_path = sys.argv[1]
feed = gk.read_feed(zip_path, dist_units="km")
print(f"loaded {zip_path}")
print(f"  agencies:   {len(feed.agency) if feed.agency is not None else 0}")
print(f"  routes:     {len(feed.routes) if feed.routes is not None else 0}")
print(f"  stops:      {len(feed.stops) if feed.stops is not None else 0}")
print(f"  trips:      {len(feed.trips) if feed.trips is not None else 0}")
print(f"  stop_times: {len(feed.stop_times) if feed.stop_times is not None else 0}")
print(f"  shapes:     {feed.shapes['shape_id'].nunique() if feed.shapes is not None else 0}")
print("gtfs-kit can read the feed ✓")
PY
