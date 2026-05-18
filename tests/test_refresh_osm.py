"""Tests for scripts/refresh_osm.py."""

from __future__ import annotations

import shutil
from pathlib import Path
from unittest.mock import patch

import pytest
from scripts.refresh_osm import refresh_osm


def test_refresh_osm_writes_pbf_to_target_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Given a stub download + stub clip, refresh_osm produces the final
    .pbf at the configured target path."""
    target = tmp_path / "colonia.osm.pbf"
    # Stub: download writes some bytes to dest.
    fake_download_payload = b"\x01\x02\x03 fake-pbf"

    def fake_download(url: str, dest: Path) -> None:
        dest.write_bytes(fake_download_payload)

    # Stub: clip just copies the input to output (no actual bbox clipping).
    def fake_clip(input_pbf: Path, output_pbf: Path, bbox: str) -> None:
        shutil.copyfile(input_pbf, output_pbf)

    refresh_osm(
        target=target,
        bbox="-57.92,-34.51,-57.78,-34.42",
        geofabrik_url="https://example/uruguay.osm.pbf",
        download_fn=fake_download,
        clip_fn=fake_clip,
    )

    assert target.is_file()
    assert target.read_bytes() == fake_download_payload


def test_refresh_osm_errors_clearly_when_osmium_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If the osmium binary is absent from PATH, the default clip helper
    raises a FileNotFoundError that mentions osmium-tool."""
    from scripts.refresh_osm import clip_osm_pbf

    # Empty PATH so any shutil.which lookup fails
    monkeypatch.setenv("PATH", "")

    with pytest.raises(FileNotFoundError, match="osmium-tool"):
        clip_osm_pbf(
            input_pbf=tmp_path / "uy.pbf",
            output_pbf=tmp_path / "colonia.pbf",
            bbox="-57.92,-34.51,-57.78,-34.42",
        )


def test_refresh_osm_main_uses_default_target(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """main() with no args writes to data/colonia.osm.pbf under cwd."""
    monkeypatch.chdir(tmp_path)

    captured_calls = []

    def fake_refresh_osm(**kwargs: object) -> None:
        captured_calls.append(kwargs)
        target = kwargs["target"]
        assert isinstance(target, Path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"fake")

    with patch("scripts.refresh_osm.refresh_osm", side_effect=fake_refresh_osm):
        from scripts.refresh_osm import main

        exit_code = main([])

    assert exit_code == 0
    assert (tmp_path / "data" / "colonia.osm.pbf").is_file()
    assert len(captured_calls) == 1
    assert captured_calls[0]["target"] == tmp_path / "data" / "colonia.osm.pbf"
