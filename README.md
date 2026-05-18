# colonia-gtfs

[![Claude Code](https://img.shields.io/badge/Claude%20Code-ready-D97757?style=flat-square)](https://code.claude.com)
[![OpenSpec](https://img.shields.io/badge/spec--driven-OpenSpec-7C3AED?style=flat-square)](https://github.com/Fission-AI/OpenSpec)
[![Validate OpenSpec](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/openspec-validate.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/openspec-validate.yml)

**Español** · [English](README.en.md)

App web mobile-first para que turistas vean cómo llegar en colectivo entre dos puntos de Colonia del Sacramento, Uruguay. Mimetiza la experiencia de Google Maps Transit, calcula los viajes localmente con OpenTripPlanner y combina horarios oficiales con la posición real de los buses.

> **Estado:** v0 en diseño. Primer PRD disponible en [`docs/prd/mvp-v0.md`](docs/prd/mvp-v0.md). Implementación pendiente, organizada como una serie de cambios OpenSpec.

## Cobertura v0

Operador **Sol Antigua** (urbano Colonia del Sacramento), líneas 3, 4, 5 y 8. Otros operadores (ABC Coop, suburbano) y geografía extendida son v0.1+.

## Stack conceptual

`viewer (Google Maps JS) → BFF (Express + TS) → OpenTripPlanner + bridge` sobre el AVL de Sol Antigua. Detalles en el [PRD §6](docs/prd/mvp-v0.md#6-arquitectura-conceptual).

## Documentación

El trabajo arranca desde un PRD, sigue con un spec en OpenSpec y termina en código.

- **[`docs/prd/`](docs/prd/)** — PRDs (Product Requirements Documents): el *qué* y el *por qué*.
- **[`openspec/`](openspec/)** — Specs y propuestas de cambio: el *cómo*.
- **[`data/`](data/)** — Feed GTFS Schedule estático (Sol Antigua urbano Colonia). Ver [`data/README.md`](data/README.md) para el contrato de mantenimiento y el flow de update.
- **[`docs/release-process.md`](docs/release-process.md)** — Cómo cortar un release del feed (rama `release/X.Y.Z` → merge → tag `vX.Y.Z` → workflow publica GitHub Release con `gtfs.zip`).
