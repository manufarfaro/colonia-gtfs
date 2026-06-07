# `tooling/` — Toolchain Python

**Español** · [English](README.en.md)

Toolchain Python del proyecto: scripts de mantenimiento del feed GTFS, sus tests y todo lo que el CI necesita. Manejado con [`uv`](https://github.com/astral-sh/uv).

[![Tooling](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/tooling.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/tooling.yml)

## Estructura

```
tooling/
├── pyproject.toml      Metadata + deps (project + dev) + config de ruff y pytest
├── uv.lock             Lockfile reproducible (commiteado)
├── scripts/
│   ├── build_gtfs_zip.py    Empaqueta data/*.txt → gtfs.zip determinístico
│   ├── build_stops_html.py  Genera docs/stops.html desde data/stops.txt
│   ├── refresh_osm.py       Descarga + clip OSM vía osmium-tool
│   ├── validate_gtfs.py     Sanity check del feed con gtfs-kit
│   └── __init__.py
└── tests/
    ├── conftest.py
    ├── test_build_gtfs_zip.py
    ├── test_refresh_osm.py
    └── test_validate_gtfs.py
```

Los scripts anclan sus paths default al **repo root** vía `Path(__file__).resolve().parents[2]`, así se comportan igual desde cualquier cwd. El argumento opcional de output acepta paths absolutos o relativos al repo root.

## Setup

```bash
# Una vez: instalar uv (https://docs.astral.sh/uv/getting-started/)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sincronizar deps (incluye dev: pytest, ruff)
uv sync --directory tooling
```

## Comandos

Todos se corren desde la raíz del repo:

| Comando | Qué hace |
|---|---|
| `uv run --directory tooling pytest` | Tests (10, incluye determinism check). |
| `uv run --directory tooling ruff check scripts tests` | Linter. |
| `uv run --directory tooling ruff format --check scripts tests` | Format check (sin escribir). |
| `uv run --directory tooling python scripts/build_gtfs_zip.py` | Empaqueta `data/*.txt` → `data/output/gtfs.zip`. Pre-requisito de `docker compose up otp` — ver [`deployment/README.md`](../deployment/README.md). |
| `uv run --directory tooling python scripts/build_stops_html.py` | Genera `docs/stops.html` desde el feed actual. |
| `uv run --directory tooling python scripts/validate_gtfs.py` | Sanity check del feed con gtfs-kit. |
| `uv run --directory tooling python scripts/refresh_osm.py` | Regenera `data/colonia.osm.pbf` (requiere `osmium-tool` en PATH). |

## Dependencias

**Runtime:**

- [`gtfs-kit`](https://pypi.org/project/gtfs-kit/) — lectura/validación lightweight del feed.
- [`httpx`](https://www.python-httpx.org/) — descarga del extract de Geofabrik.

**Dev:**

- [`pytest`](https://docs.pytest.org/) — runner de tests.
- [`ruff`](https://docs.astral.sh/ruff/) — linter + formatter (reemplaza black + flake8 + isort + pyupgrade).

**Externas (no Python):**

- [`osmium-tool`](https://osmcode.org/osmium-tool/) — para el bbox clip de OSM. `brew install osmium-tool` (macOS) o `apt-get install osmium-tool` (Debian).

## CI

Tres workflows en `.github/workflows/` consumen este toolchain:

- **`tooling.yml`** — corre `ruff check`, `ruff format --check`, `pytest` en cada push/PR que toca `tooling/**`.
- **`validate-gtfs.yml`** — usa `build_gtfs_zip.py` para armar `gtfs.zip` y lo valida con el [MobilityData Canonical Validator](https://github.com/MobilityData/gtfs-validator) (vía [`npaun/md-gtfs-validator-action@v2`](https://github.com/npaun/md-gtfs-validator-action)).
- **`release.yml`** — al pushear tag `v*.*.*`, build + validate + publica un GitHub Release con `gtfs.zip` adjunto.

## TDD

Cada script Python tiene sus tests escritos primero (red), después la implementación mínima (green). 15 tests cubren:

- **`test_build_gtfs_zip.py`** (5): contenido del zip, determinismo byte-a-byte resistente a cambios de mtime, error con data dir vacío, CLI con default y con path absoluto.
- **`test_build_stops_html.py`** (3): orden numérico de paradas, escaping HTML, escritura del archivo estático.
- **`test_reference_processed_data.py`** (2): auditoría opcional contra la captura AVL procesada externa local.
- **`test_refresh_osm.py`** (3): orchestrator con stubs de download+clip, error claro cuando falta `osmium-tool`, default target.
- **`test_validate_gtfs.py`** (2): summary para feed válido, error con zip inexistente.

Los tests usan `monkeypatch.setattr` sobre las constantes `DEFAULT_DATA_DIR` / `DEFAULT_OUTPUT` / `DEFAULT_TARGET` para inyectar tmp_paths, en vez de `monkeypatch.chdir` — es más limpio porque no toca el cwd del proceso.

## Spec

El contrato verificable que satisface este toolchain vive en [`openspec/specs/gtfs-static-data/spec.md`](../openspec/specs/gtfs-static-data/spec.md) (post-archive del change `data-layer-gtfs-static`). Mientras tanto, el spec draft está en [`openspec/changes/data-layer-gtfs-static/specs/gtfs-static-data/spec.md`](../openspec/changes/data-layer-gtfs-static/specs/gtfs-static-data/spec.md).
