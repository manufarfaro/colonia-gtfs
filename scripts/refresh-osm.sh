#!/usr/bin/env bash
#
# refresh-osm.sh — Regenerate data/colonia.osm.pbf from Geofabrik UY,
# clipped to the Colonia urban bbox.
#
# Required tooling:
#   macOS:  brew install osmium-tool
#   Debian: apt-get install osmium-tool
#
# Bbox: -57.92,-34.51,-57.78,-34.42
#   Covers Real de San Carlos (north end of L3) to Algodones (south end
#   of L8), plus the urban core of Colonia del Sacramento.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

if ! command -v osmium > /dev/null; then
  echo "error: osmium-tool not installed" >&2
  echo "       macOS:  brew install osmium-tool" >&2
  echo "       debian: apt-get install osmium-tool" >&2
  exit 1
fi

GEOFABRIK_URL="https://download.geofabrik.de/south-america/uruguay-latest.osm.pbf"
BBOX="-57.92,-34.51,-57.78,-34.42"

echo "downloading $GEOFABRIK_URL ..."
curl -fL --silent --show-error --output "$TMPDIR/uruguay-latest.osm.pbf" "$GEOFABRIK_URL"

echo "clipping to bbox $BBOX ..."
osmium extract --overwrite --bbox "$BBOX" --output "$TMPDIR/colonia.osm.pbf" "$TMPDIR/uruguay-latest.osm.pbf"

mkdir -p "$DATA_DIR"
mv "$TMPDIR/colonia.osm.pbf" "$DATA_DIR/colonia.osm.pbf"

SIZE=$(du -h "$DATA_DIR/colonia.osm.pbf" | awk '{print $1}')
echo "wrote $DATA_DIR/colonia.osm.pbf ($SIZE)"
