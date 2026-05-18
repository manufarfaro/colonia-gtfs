"""Shared pytest fixtures for the colonia-gtfs scripts."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def tiny_gtfs_data_dir(tmp_path: Path) -> Path:
    """A minimal but referentially-consistent GTFS data directory.

    Contains just enough rows to satisfy ``gtfs-kit.read_feed`` and the
    Canonical validator's required-file checks. Not meant to model
    Sol Antigua — small synthetic feed for tests only.
    """
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    (data_dir / "agency.txt").write_text(
        "agency_id,agency_name,agency_url,agency_timezone\n"
        "fixture,Fixture Agency,https://example.com,America/Montevideo\n"
    )
    (data_dir / "stops.txt").write_text(
        "stop_id,stop_name,stop_lat,stop_lon\n"
        "S1,Origin,-34.470,-57.850\n"
        "S2,Destination,-34.480,-57.840\n"
    )
    (data_dir / "routes.txt").write_text(
        "route_id,agency_id,route_short_name,route_long_name,route_type\n"
        "R1,fixture,1,Origin to Destination,3\n"
    )
    (data_dir / "trips.txt").write_text("route_id,service_id,trip_id\nR1,daily,T1\n")
    (data_dir / "stop_times.txt").write_text(
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
        "T1,08:00:00,08:00:00,S1,1\n"
        "T1,08:15:00,08:15:00,S2,2\n"
    )
    (data_dir / "calendar.txt").write_text(
        "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,"
        "start_date,end_date\n"
        "daily,1,1,1,1,1,1,1,20260101,20261231\n"
    )

    return data_dir
