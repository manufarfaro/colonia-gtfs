"""Package data/*.txt into a byte-deterministic gtfs.zip.

CLI (from the repo root):
  ``uv run --directory tooling python scripts/build_gtfs_zip.py [output_path]``

Default output: ``<repo-root>/data/output/gtfs.zip``. Supports absolute and
repo-relative paths.
"""

from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

# Fixed timestamp written into every zip entry header so the archive bytes
# are stable across runs regardless of filesystem mtimes.
FIXED_DATE_TIME = (2026, 1, 1, 0, 0, 0)

# Anchor defaults to the repo root so the script behaves the same regardless
# of cwd. ``tooling/scripts/build_gtfs_zip.py`` -> ``parents[2]`` is the repo
# root.
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = REPO_ROOT / "data"
DEFAULT_OUTPUT = REPO_ROOT / "data" / "output" / "gtfs.zip"


def build_gtfs_zip(data_dir: Path, output_path: Path) -> None:
    txt_files = sorted(data_dir.glob("*.txt"))
    if not txt_files:
        raise FileNotFoundError(f"no .txt files in {data_dir}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for txt in txt_files:
            info = zipfile.ZipInfo(filename=txt.name, date_time=FIXED_DATE_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, txt.read_bytes())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Package data/*.txt into a deterministic gtfs.zip")
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help=f"output zip path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)

    if args.output is None:
        output_path = DEFAULT_OUTPUT
    else:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = REPO_ROOT / output_path

    build_gtfs_zip(data_dir=DEFAULT_DATA_DIR, output_path=output_path)
    print(f"built {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
