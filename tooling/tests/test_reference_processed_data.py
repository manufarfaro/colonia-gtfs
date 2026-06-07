"""Regression checks against the external AVL reference data."""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
REFERENCE_ROOT = Path("/Users/manufarfaro/Documents/Claude/Projects/Colonia Mobilidad")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return [{k: v.strip() for k, v in row.items()} for row in csv.DictReader(f)]


def test_current_stops_match_non_low_confidence_avl_reference() -> None:
    reference_stops_path = REFERENCE_ROOT / "data" / "processed" / "stops.csv"
    if not reference_stops_path.is_file():
        pytest.skip(f"external AVL reference not available: {reference_stops_path}")

    current = {
        (row["stop_id"], row["stop_name"], row["stop_lat"], row["stop_lon"])
        for row in read_csv(REPO_ROOT / "data" / "stops.txt")
    }
    reference = {
        (row["p1c"], row["p1n"], row["lat_mean"], row["lon_mean"])
        for row in read_csv(reference_stops_path)
        if row["confidence"] != "baja"
    }

    assert current == reference


def test_current_stop_times_do_not_reference_low_confidence_avl_stops() -> None:
    reference_stops_path = REFERENCE_ROOT / "data" / "processed" / "stops.csv"
    if not reference_stops_path.is_file():
        pytest.skip(f"external AVL reference not available: {reference_stops_path}")

    low_confidence = {
        row["p1c"] for row in read_csv(reference_stops_path) if row["confidence"] == "baja"
    }
    used_stop_ids = {row["stop_id"] for row in read_csv(REPO_ROOT / "data" / "stop_times.txt")}

    assert used_stop_ids.isdisjoint(low_confidence)
