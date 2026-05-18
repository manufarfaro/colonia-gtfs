#!/usr/bin/env bash
#
# build-gtfs-zip.sh — Package data/*.txt into a deterministic gtfs.zip.
#
# Usage:  scripts/build-gtfs-zip.sh [output_path]
# Default output: data/output/gtfs.zip
#
# Determinism: all source .txt files have their mtime set to a fixed
# epoch before zipping, and `zip -X` strips extra attributes. Two
# consecutive runs against unchanged input produce byte-identical
# output (see scripts/test-build-deterministic.sh).

set -euo pipefail

OUT="${1:-data/output/gtfs.zip}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data"
EPOCH="2026-01-01 00:00:00"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "error: $DATA_DIR does not exist" >&2
  exit 1
fi

if ! ls "$DATA_DIR"/*.txt > /dev/null 2>&1; then
  echo "error: no .txt files in $DATA_DIR" >&2
  echo "       (this is expected before the GTFS feed is authored;" >&2
  echo "        see openspec/changes/data-layer-gtfs-static/tasks.md)" >&2
  exit 1
fi

mkdir -p "$(dirname "$ROOT/$OUT")"
rm -f "$ROOT/$OUT"

# Normalize mtimes so the zip is byte-deterministic across runs.
find "$DATA_DIR" -maxdepth 1 -name '*.txt' -exec touch -d "$EPOCH" {} \;

# Sort filenames lexically so order in the archive is deterministic.
FILES=$(cd "$DATA_DIR" && ls *.txt | LC_ALL=C sort | tr '\n' ' ')

( cd "$DATA_DIR" && zip -X -q "$ROOT/$OUT" $FILES )

echo "built $OUT ($(du -h "$ROOT/$OUT" | awk '{print $1}'))"
