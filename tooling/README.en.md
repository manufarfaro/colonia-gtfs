# `tooling/` — Python toolchain

[Español](README.md) · **English**

The project's Python toolchain: GTFS feed maintenance scripts, their tests, and everything CI needs. Managed by [`uv`](https://github.com/astral-sh/uv).

[![Python](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/python.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/python.yml)

## Layout

```
tooling/
├── pyproject.toml      Metadata + deps (project + dev) + ruff and pytest config
├── uv.lock             Reproducible lockfile (committed)
├── scripts/
│   ├── build_gtfs_zip.py    Package data/*.txt → deterministic gtfs.zip
│   ├── refresh_osm.py       Download + clip OSM via osmium-tool
│   ├── validate_gtfs.py     Feed sanity check with gtfs-kit
│   └── __init__.py
└── tests/
    ├── conftest.py
    ├── test_build_gtfs_zip.py
    ├── test_refresh_osm.py
    └── test_validate_gtfs.py
```

Scripts anchor their default paths to the **repo root** via `Path(__file__).resolve().parents[2]`, so they behave the same regardless of cwd. The optional output argument supports absolute or repo-relative paths.

## Setup

```bash
# One-off: install uv (https://docs.astral.sh/uv/getting-started/)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sync deps (includes dev: pytest, ruff)
uv sync --directory tooling
```

## Commands

All run from the repo root:

| Command | What it does |
|---|---|
| `uv run --directory tooling pytest` | Tests (10, includes determinism check). |
| `uv run --directory tooling ruff check scripts tests` | Linter. |
| `uv run --directory tooling ruff format --check scripts tests` | Format check (no writes). |
| `uv run --directory tooling python scripts/build_gtfs_zip.py` | Package `data/*.txt` → `data/output/gtfs.zip`. |
| `uv run --directory tooling python scripts/validate_gtfs.py` | Feed sanity check with gtfs-kit. |
| `uv run --directory tooling python scripts/refresh_osm.py` | Regenerate `data/colonia.osm.pbf` (requires `osmium-tool` on PATH). |

## Dependencies

**Runtime:**

- [`gtfs-kit`](https://pypi.org/project/gtfs-kit/) — lightweight feed reading/validation.
- [`httpx`](https://www.python-httpx.org/) — Geofabrik extract download.

**Dev:**

- [`pytest`](https://docs.pytest.org/) — test runner.
- [`ruff`](https://docs.astral.sh/ruff/) — linter + formatter (replaces black + flake8 + isort + pyupgrade).

**External (non-Python):**

- [`osmium-tool`](https://osmcode.org/osmium-tool/) — for the OSM bbox clip. `brew install osmium-tool` (macOS) or `apt-get install osmium-tool` (Debian).

## CI

Three workflows in `.github/workflows/` consume this toolchain:

- **`python.yml`** — runs `ruff check`, `ruff format --check`, `pytest` on every push/PR touching `tooling/**`.
- **`validate-gtfs.yml`** — uses `build_gtfs_zip.py` to assemble `gtfs.zip` and validates it with the [MobilityData Canonical Validator](https://github.com/MobilityData/gtfs-validator) (via [`npaun/md-gtfs-validator-action@v2`](https://github.com/npaun/md-gtfs-validator-action)).
- **`release.yml`** — on `v*.*.*` tag push: build + validate + publish a GitHub Release with `gtfs.zip` attached.

## TDD

Each Python script has tests written first (red), then the minimal implementation (green). 10 tests cover:

- **`test_build_gtfs_zip.py`** (5): zip contents, mtime-resilient byte determinism, error on empty data dir, CLI default and absolute path.
- **`test_refresh_osm.py`** (3): orchestrator with download+clip stubs, clear error when `osmium-tool` is missing, default target.
- **`test_validate_gtfs.py`** (2): summary for a valid feed, error on missing zip.

Tests use `monkeypatch.setattr` against the `DEFAULT_DATA_DIR` / `DEFAULT_OUTPUT` / `DEFAULT_TARGET` constants to inject `tmp_path`s instead of `monkeypatch.chdir` — cleaner because it doesn't touch the process cwd.

## Spec

The verifiable contract that this toolchain satisfies lives at [`openspec/specs/gtfs-static-data/spec.md`](../openspec/specs/gtfs-static-data/spec.md) (post-archive of the `data-layer-gtfs-static` change). Until then, the draft spec is at [`openspec/changes/data-layer-gtfs-static/specs/gtfs-static-data/spec.md`](../openspec/changes/data-layer-gtfs-static/specs/gtfs-static-data/spec.md).
