# colonia-gtfs

[![Claude Code](https://img.shields.io/badge/Claude%20Code-ready-D97757?style=flat-square)](https://code.claude.com)
[![OpenSpec](https://img.shields.io/badge/spec--driven-OpenSpec-7C3AED?style=flat-square)](https://github.com/Fission-AI/OpenSpec)
[![Validate OpenSpec](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/openspec-validate.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/openspec-validate.yml)
[![Validate GTFS](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/validate-gtfs.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/validate-gtfs.yml)
[![Tooling](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/tooling.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/tooling.yml)
[![OTP Smoke](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/otp-smoke.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/otp-smoke.yml)
[![Bridge](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge.yml)
[![Bridge RT validate](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge-rt-validate.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/bridge-rt-validate.yml)

[Español](README.md) · **English**

Mobile-first web app that lets tourists plan bus trips between two points in Colonia del Sacramento, Uruguay. Mirrors the Google Maps Transit experience, computes itineraries locally with OpenTripPlanner, and combines schedule data with live vehicle positions.

> **Status:** v0 in design. First PRD available at [`docs/prd/mvp-v0.md`](docs/prd/mvp-v0.md) (Spanish). Implementation pending, organized as a series of OpenSpec changes.

## v0 scope

Operator **Sol Antigua** (urban Colonia del Sacramento), lines 3, 4, 5, and 8. Other operators (ABC Coop, suburban routes) and broader geography are v0.1+.

## Conceptual stack

`viewer (Google Maps JS) → BFF (Express + TS) → OpenTripPlanner + bridge` over the Sol Antigua AVL feed. Details in [PRD §6](docs/prd/mvp-v0.md#6-arquitectura-conceptual).

## Documentation

Work starts from a PRD, then an OpenSpec spec, then code.

- **[`docs/prd/`](docs/prd/)** — PRDs (Product Requirements Documents): the *what* and *why*.
- **[`openspec/`](openspec/)** — Specs and change proposals: the *how*.
- **[`data/`](data/)** — Static GTFS Schedule feed (Sol Antigua urbano Colonia). See [`data/README.md`](data/README.md) for the maintenance contract and update flow.
- **[`deployment/`](deployment/)** — Runtime stack (Docker Compose): OpenTripPlanner 2 over the static feed. See [`deployment/README.en.md`](deployment/README.en.md) for boot, healthz, and troubleshooting.
- **[`bridge/`](bridge/)** — NestJS service that polls the operator's AVL and emits GTFS-Realtime for OTP. See [`bridge/README.en.md`](bridge/README.en.md) for the endpoint contract, healthz, behavior when the AVL is down, and handling of the `ORIGIN_AVL` secret.
- **[`docs/release-process.md`](docs/release-process.md)** — How to cut a release of the feed (open `release/X.Y.Z` → merge → tag `vX.Y.Z` → workflow publishes a GitHub Release with `gtfs.zip`).

## Development

The Python toolchain (build/validate/refresh scripts, tests, lints, CI helpers) lives under [`tooling/`](tooling/). Setup, commands, and dependencies in [`tooling/README.md`](tooling/README.md).
