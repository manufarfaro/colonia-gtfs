"""Package data/*.txt into a byte-deterministic gtfs.zip.

CLI: ``uv run python scripts/build_gtfs_zip.py [output_path]``
Default output: ``data/output/gtfs.zip`` (relative to the current working
directory). Supports absolute paths.
"""

from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

# Fixed timestamp written into every zip entry header so the archive bytes
# are stable across runs regardless of filesystem mtimes.
FIXED_DATE_TIME = (2026, 1, 1, 0, 0, 0)

DEFAULT_DATA_DIR = Path("data")
DEFAULT_OUTPUT = Path("data/output/gtfs.zip")


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
        default=str(DEFAULT_OUTPUT),
        help=f"output zip path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = Path.cwd() / output_path

    data_dir = Path.cwd() / DEFAULT_DATA_DIR
    build_gtfs_zip(data_dir=data_dir, output_path=output_path)
    print(f"built {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
