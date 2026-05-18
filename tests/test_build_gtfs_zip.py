"""Tests for scripts/build_gtfs_zip.py."""

from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path

import pytest
from scripts.build_gtfs_zip import build_gtfs_zip, main


def test_build_creates_zip_with_data_txt_files(tmp_path: Path, tiny_gtfs_data_dir: Path) -> None:
    output = tmp_path / "out" / "gtfs.zip"

    build_gtfs_zip(data_dir=tiny_gtfs_data_dir, output_path=output)

    assert output.is_file()
    with zipfile.ZipFile(output) as z:
        assert set(z.namelist()) == {
            "agency.txt",
            "stops.txt",
            "routes.txt",
            "trips.txt",
            "stop_times.txt",
            "calendar.txt",
        }


def test_build_is_byte_deterministic_across_mtime_changes(
    tmp_path: Path, tiny_gtfs_data_dir: Path
) -> None:
    """Touching source .txt files (changing mtime but not content) must not
    affect the resulting zip byte-for-byte. This guards the spec R-11
    contract (fixed timestamps in archive)."""
    import os
    import time

    a = tmp_path / "a.zip"
    b = tmp_path / "b.zip"

    build_gtfs_zip(data_dir=tiny_gtfs_data_dir, output_path=a)

    # Force a new mtime on every source file. Use an explicit future time
    # to avoid filesystem mtime resolution issues.
    future = time.time() + 1
    for txt in tiny_gtfs_data_dir.glob("*.txt"):
        os.utime(txt, (future, future))

    build_gtfs_zip(data_dir=tiny_gtfs_data_dir, output_path=b)

    assert hashlib.sha256(a.read_bytes()).hexdigest() == hashlib.sha256(b.read_bytes()).hexdigest()


def test_build_errors_when_data_dir_has_no_txt_files(tmp_path: Path) -> None:
    empty_dir = tmp_path / "data"
    empty_dir.mkdir()

    with pytest.raises(FileNotFoundError, match="no .txt files"):
        build_gtfs_zip(data_dir=empty_dir, output_path=tmp_path / "out.zip")


def test_main_defaults_to_data_output_gtfs_zip(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, tiny_gtfs_data_dir: Path
) -> None:
    """Calling main() with no args writes to {cwd}/data/output/gtfs.zip,
    using {cwd}/data/ as source. Run from a tmp working dir wired to the
    fixture data."""
    # tiny_gtfs_data_dir is at tmp_path / "data". monkeypatch cwd → tmp_path
    # so the script's relative-path defaults resolve to the fixture.
    monkeypatch.chdir(tmp_path)

    exit_code = main([])

    assert exit_code == 0
    assert (tmp_path / "data" / "output" / "gtfs.zip").is_file()


def test_main_accepts_absolute_output_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, tiny_gtfs_data_dir: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    target = tmp_path / "custom" / "feed.zip"

    exit_code = main([str(target)])

    assert exit_code == 0
    assert target.is_file()
