"""Tests for scripts/build_stops_html.py."""

from __future__ import annotations

from pathlib import Path

from scripts.build_stops_html import build_stops_html, read_stops, render_stops_html


def test_read_stops_sorts_numeric_stop_ids(tmp_path: Path) -> None:
    stops_txt = tmp_path / "stops.txt"
    stops_txt.write_text(
        "stop_id,stop_name,stop_lat,stop_lon\n10,Italia,-34.46,-57.84\n2,Ituzaingo,-34.47,-57.85\n",
        encoding="utf-8",
    )

    stops = read_stops(stops_txt)

    assert [stop.stop_id for stop in stops] == ["2", "10"]


def test_render_stops_html_escapes_stop_names() -> None:
    html = render_stops_html(
        [
            {
                "stop_id": "1",
                "stop_name": 'Centro & "Puerto"',
                "stop_lat": "-34.470684",
                "stop_lon": "-57.852208",
            }
        ],
        feed_version="0.3.0",
    )

    assert "Centro &amp; &quot;Puerto&quot;" in html
    assert "Version GTFS 0.3.0" in html
    assert "https://www.openstreetmap.org/?mlat=-34.470684&amp;mlon=-57.852208" in html


def test_build_stops_html_writes_output(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "stops.txt").write_text(
        "stop_id,stop_name,stop_lat,stop_lon\n1,REAL,-34.470684,-57.852208\n",
        encoding="utf-8",
    )
    (data_dir / "feed_info.txt").write_text(
        "feed_publisher_name,feed_publisher_url,feed_lang,feed_version\n"
        "Fixture,https://example.com,es,0.3.0\n",
        encoding="utf-8",
    )
    output = tmp_path / "docs" / "stops.html"

    build_stops_html(data_dir=data_dir, output_path=output)

    assert output.is_file()
    assert "REAL" in output.read_text(encoding="utf-8")
