#!/usr/bin/env bash
#
# test-build-deterministic.sh — Verify scripts/build-gtfs-zip.sh produces
# byte-identical output on two consecutive runs against unchanged input.
# Exit 0 if deterministic, non-zero otherwise.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

"$SCRIPT_DIR/build-gtfs-zip.sh" "$TMPDIR/a.zip" > /dev/null
"$SCRIPT_DIR/build-gtfs-zip.sh" "$TMPDIR/b.zip" > /dev/null

HASH_A=$(shasum -a 256 "$TMPDIR/a.zip" | awk '{print $1}')
HASH_B=$(shasum -a 256 "$TMPDIR/b.zip" | awk '{print $1}')

if [[ "$HASH_A" == "$HASH_B" ]]; then
  echo "deterministic ✓ ($HASH_A)"
  exit 0
fi

echo "not deterministic ✗" >&2
echo "  run 1: $HASH_A" >&2
echo "  run 2: $HASH_B" >&2
exit 1
