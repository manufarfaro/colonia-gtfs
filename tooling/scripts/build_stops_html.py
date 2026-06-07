"""Build a static stops index from the GTFS stops.txt file.

CLI (from the repo root):
  ``uv run --directory tooling python scripts/build_stops_html.py [output_path]``

Default output: ``<repo-root>/docs/stops.html``.
"""

from __future__ import annotations

import argparse
import csv
import html
import sys
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = REPO_ROOT / "data"
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "stops.html"


@dataclass(frozen=True)
class Stop:
    stop_id: str
    stop_name: str
    stop_lat: str
    stop_lon: str


def stop_sort_key(stop: Stop) -> tuple[int, int | str]:
    if stop.stop_id.isdigit():
        return (0, int(stop.stop_id))
    return (1, stop.stop_id)


def read_stops(stops_path: Path) -> list[Stop]:
    with stops_path.open(newline="", encoding="utf-8-sig") as f:
        rows = csv.DictReader(f)
        stops = [
            Stop(
                stop_id=(row["stop_id"] or "").strip(),
                stop_name=(row["stop_name"] or "").strip(),
                stop_lat=(row["stop_lat"] or "").strip(),
                stop_lon=(row["stop_lon"] or "").strip(),
            )
            for row in rows
        ]
    return sorted(stops, key=stop_sort_key)


def read_feed_version(feed_info_path: Path) -> str:
    if not feed_info_path.is_file():
        return "sin version"
    with feed_info_path.open(newline="", encoding="utf-8-sig") as f:
        rows = csv.DictReader(f)
        first = next(rows, None)
    if first is None:
        return "sin version"
    return (first.get("feed_version") or "sin version").strip()


def coerce_stop(stop: Stop | Mapping[str, str]) -> Stop:
    if isinstance(stop, Stop):
        return stop
    return Stop(
        stop_id=stop["stop_id"],
        stop_name=stop["stop_name"],
        stop_lat=stop["stop_lat"],
        stop_lon=stop["stop_lon"],
    )


def render_stops_html(stops: Iterable[Stop | Mapping[str, str]], feed_version: str) -> str:
    stop_list = sorted((coerce_stop(stop) for stop in stops), key=stop_sort_key)
    rows = "\n".join(render_stop_row(stop) for stop in stop_list)
    count = len(stop_list)
    escaped_version = html.escape(feed_version, quote=True)
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paradas Sol Antigua - colonia-gtfs</title>
  <style>
    :root {{
      --ink: #1d2528;
      --muted: #5f6f75;
      --line: #d7e0dc;
      --paper: #f8f6ee;
      --panel: #ffffff;
      --accent: #0f7c68;
      --accent-2: #c14f32;
      --shadow: 0 16px 40px rgba(29, 37, 40, 0.09);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(90deg, rgba(15,124,104,0.08) 1px, transparent 1px),
        linear-gradient(rgba(15,124,104,0.06) 1px, transparent 1px),
        var(--paper);
      background-size: 28px 28px;
      font-family: Georgia, "Times New Roman", serif;
    }}
    main {{
      width: min(1120px, calc(100% - 28px));
      margin: 0 auto;
      padding: 34px 0 56px;
    }}
    header {{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: end;
      margin-bottom: 22px;
      border-bottom: 3px solid var(--ink);
      padding-bottom: 18px;
    }}
    h1 {{
      margin: 0;
      font-size: clamp(2rem, 5vw, 4.8rem);
      line-height: 0.92;
      letter-spacing: 0;
      max-width: 760px;
    }}
    .meta {{
      text-align: right;
      color: var(--muted);
      font: 700 0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      text-transform: uppercase;
    }}
    .note {{
      margin: 0 0 24px;
      max-width: 760px;
      color: var(--muted);
      font-size: 1.05rem;
      line-height: 1.5;
    }}
    .table-wrap {{
      overflow-x: auto;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }}
    th, td {{
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
    }}
    th {{
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--ink);
      color: #fff;
      font: 800 0.76rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      text-transform: uppercase;
    }}
    td {{
      font-size: 0.98rem;
    }}
    td:first-child {{
      color: var(--accent-2);
      font: 800 0.9rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      width: 86px;
    }}
    tr:hover td {{
      background: #edf6f3;
    }}
    a {{
      color: var(--accent);
      font-weight: 700;
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
    }}
    .coords {{
      color: var(--muted);
      font: 0.86rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }}
    @media (max-width: 720px) {{
      header {{
        grid-template-columns: 1fr;
      }}
      .meta {{
        text-align: left;
      }}
      main {{
        width: min(100% - 18px, 1120px);
        padding-top: 20px;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Paradas urbanas de Sol Antigua</h1>
      <div class="meta">
        <div>{count} paradas</div>
        <div>Version GTFS {escaped_version}</div>
      </div>
    </header>
    <p class="note">
      Inventario de paradas publicado desde el feed GTFS Schedule de colonia-gtfs.
      Las coordenadas provienen de la captura AVL del operador y son referenciales
      para planificacion y visualizacion.
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Parada</th>
            <th>Coordenadas</th>
            <th>Mapa</th>
          </tr>
        </thead>
        <tbody>
{rows}
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>
"""


def render_stop_row(stop: Stop) -> str:
    stop_id = html.escape(stop.stop_id, quote=True)
    stop_name = html.escape(stop.stop_name, quote=True)
    stop_lat = html.escape(stop.stop_lat, quote=True)
    stop_lon = html.escape(stop.stop_lon, quote=True)
    map_url = (
        "https://www.openstreetmap.org/"
        f"?mlat={stop_lat}&amp;mlon={stop_lon}#map=18/{stop_lat}/{stop_lon}"
    )
    return (
        "          <tr>"
        f"<td>{stop_id}</td>"
        f"<td>{stop_name}</td>"
        f'<td class="coords">{stop_lat}, {stop_lon}</td>'
        f'<td><a href="{map_url}">Abrir</a></td>'
        "</tr>"
    )


def build_stops_html(data_dir: Path, output_path: Path) -> None:
    stops = read_stops(data_dir / "stops.txt")
    feed_version = read_feed_version(data_dir / "feed_info.txt")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_stops_html(stops, feed_version), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build static HTML listing GTFS stops")
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help=f"output HTML path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)

    if args.output is None:
        output_path = DEFAULT_OUTPUT
    else:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = REPO_ROOT / output_path

    build_stops_html(data_dir=DEFAULT_DATA_DIR, output_path=output_path)
    print(f"built {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
