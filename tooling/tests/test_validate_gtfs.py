"""Tests for scripts/validate_gtfs.py."""

from __future__ import annotations

from pathlib import Path

import pytest
from scripts.build_gtfs_zip import build_gtfs_zip
from scripts.validate_gtfs import main


def test_validate_prints_summary_for_valid_feed(
    tmp_path: Path, tiny_gtfs_data_dir: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    zip_path = tmp_path / "gtfs.zip"
    build_gtfs_zip(data_dir=tiny_gtfs_data_dir, output_path=zip_path)

    exit_code = main([str(zip_path)])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "agencies:" in captured.out
    assert "routes:" in captured.out
    assert "stops:" in captured.out
    assert "trips:" in captured.out


def test_validate_errors_when_zip_does_not_exist(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    missing = tmp_path / "nope.zip"

    exit_code = main([str(missing)])

    captured = capsys.readouterr()
    assert exit_code != 0
    assert "does not exist" in captured.err or "no such file" in captured.err.lower()
