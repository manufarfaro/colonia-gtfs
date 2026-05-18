"""Local sanity-check of a static GTFS feed using gtfs-kit.

The authoritative validation in CI uses the MobilityData Canonical
Validator (see ``.github/workflows/validate-gtfs.yml``); this script is
a lightweight pre-push check that proves the feed is well-formed enough
for ``gtfs_kit.read_feed`` to load it.

CLI: ``uv run python scripts/validate_gtfs.py [zip_path]``
Default: ``data/output/gtfs.zip``
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import gtfs_kit as gk

DEFAULT_ZIP = Path("data/output/gtfs.zip")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sanity-check a GTFS zip with gtfs-kit")
    parser.add_argument(
        "zip_path",
        nargs="?",
        default=str(DEFAULT_ZIP),
        help=f"path to the GTFS zip (default: {DEFAULT_ZIP})",
    )
    args = parser.parse_args(argv)

    zip_path = Path(args.zip_path)
    if not zip_path.is_absolute():
        zip_path = Path.cwd() / zip_path

    if not zip_path.is_file():
        print(f"error: {zip_path} does not exist", file=sys.stderr)
        return 1

    feed = gk.read_feed(zip_path, dist_units="km")
    print(f"loaded {zip_path}")
    print(f"  agencies:   {0 if feed.agency is None else len(feed.agency)}")
    print(f"  routes:     {0 if feed.routes is None else len(feed.routes)}")
    print(f"  stops:      {0 if feed.stops is None else len(feed.stops)}")
    print(f"  trips:      {0 if feed.trips is None else len(feed.trips)}")
    print(f"  stop_times: {0 if feed.stop_times is None else len(feed.stop_times)}")
    print(f"  shapes:     {0 if feed.shapes is None else feed.shapes['shape_id'].nunique()}")
    print("gtfs-kit can read the feed ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
