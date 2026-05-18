"""Regenerate ``data/colonia.osm.pbf`` from Geofabrik UY clipped by bbox.

Requires ``osmium-tool`` on PATH (``brew install osmium-tool`` on macOS or
``apt-get install osmium-tool`` on Debian). The HTTP download is done in
Python; the bbox clip is delegated to ``osmium extract`` (subprocess).

CLI: ``uv run python scripts/refresh_osm.py [target_path]``
Default target: ``data/colonia.osm.pbf``
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path

import httpx

GEOFABRIK_URL = "https://download.geofabrik.de/south-america/uruguay-latest.osm.pbf"
BBOX = "-57.92,-34.51,-57.78,-34.42"
DEFAULT_TARGET = Path("data/colonia.osm.pbf")


def download_pbf(url: str, dest: Path) -> None:
    """Stream-download ``url`` into ``dest``."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as response:
        response.raise_for_status()
        with dest.open("wb") as fh:
            for chunk in response.iter_bytes():
                fh.write(chunk)


def clip_osm_pbf(input_pbf: Path, output_pbf: Path, bbox: str) -> None:
    """Clip ``input_pbf`` to ``bbox`` writing ``output_pbf`` via osmium-tool."""
    if shutil.which("osmium") is None:
        raise FileNotFoundError(
            "osmium-tool not installed. macOS: brew install osmium-tool. "
            "Debian: apt-get install osmium-tool."
        )
    output_pbf.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "osmium",
            "extract",
            "--overwrite",
            "--bbox",
            bbox,
            "--output",
            str(output_pbf),
            str(input_pbf),
        ],
        check=True,
    )


def refresh_osm(
    *,
    target: Path,
    bbox: str = BBOX,
    geofabrik_url: str = GEOFABRIK_URL,
    download_fn: Callable[[str, Path], None] = download_pbf,
    clip_fn: Callable[[Path, Path, str], None] = clip_osm_pbf,
) -> None:
    """Download Uruguay pbf and clip it to ``bbox``, writing ``target``."""
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        downloaded = tmpdir / "uruguay-latest.osm.pbf"
        download_fn(geofabrik_url, downloaded)
        clip_fn(downloaded, target, bbox)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate data/colonia.osm.pbf from Geofabrik UY"
    )
    parser.add_argument(
        "target",
        nargs="?",
        default=str(DEFAULT_TARGET),
        help=f"output .pbf path (default: {DEFAULT_TARGET})",
    )
    args = parser.parse_args(argv)

    target = Path(args.target)
    if not target.is_absolute():
        target = Path.cwd() / target

    refresh_osm(target=target)
    size_bytes = target.stat().st_size
    print(f"wrote {target} ({size_bytes / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
