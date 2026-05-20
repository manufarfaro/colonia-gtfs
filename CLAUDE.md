# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mobile-first web app that lets tourists plan bus trips in Colonia del Sacramento, Uruguay. Mirrors the Google Maps Transit UX; computes itineraries locally with OpenTripPlanner 2 (no dependency on Google Transit Partners) and combines static GTFS data with realtime vehicle positions from a custom bridge over the Sol Antigua AVL feed.

The repository currently contains no implementation code — only the OpenSpec scaffolding and the v0 PRD ([`docs/prd/mvp-v0.md`](docs/prd/mvp-v0.md)). Implementation will arrive as a series of OpenSpec changes (see PRD §11 for the decomposition).

**Stack (conceptual):** viewer (HTML + Google Maps JS API) → BFF (Express + TypeScript) → OTP (Docker) + bridge (NestJS) → Sol Antigua AVL. Operator scope in v0: Sol Antigua urbano Colonia, lines 3, 4, 5, 8.

## Workflow: PRD → spec → code

The project follows a three-stage flow. Each stage answers a different question and feeds the next:

1. **PRD** — `docs/prd/<feature>.md`. Source of truth for *what* and *why*: user-facing capability, goals, non-goals, constraints. Iterate here until product questions are resolved; many "why" questions that would otherwise interrupt spec-writing get answered up front.
2. **Spec** — `openspec/specs/` (committed) and `openspec/changes/<name>/` (in-flight). Source of truth for *how*: behavior, data model, interfaces. A spec must reference the PRD it implements.
3. **Code** — implements the spec. Runs after the change's `tasks.md` is complete.

Always read the relevant PRD in `docs/prd/` before drafting or modifying a spec. Do not skip the PRD step for non-trivial work — if a PRD is missing, write or extend one first.

## OpenSpec workflow

All non-trivial work goes through OpenSpec. Use the project's slash commands:

- `/opsx:explore <topic>` — investigate options before proposing
- `/opsx:propose <name-or-description>` — scaffold a change under `openspec/changes/<name>/` with `proposal.md` (what & why), `design.md` (how), and `tasks.md` (steps)
- `/opsx:apply <name>` — implement a proposed change
- `/opsx:archive <name>` — move completed change to `openspec/changes/archive/`

Underlying CLI (used by the commands; rarely invoked directly):
- `openspec new change "<name>"` — scaffold a change
- `openspec status --change "<name>" [--json]` — check artifact readiness
- `openspec instructions <artifact-id> --change "<name>" --json` — get the template, rules, and dependencies for an artifact

When creating artifacts, the `context`/`rules` blocks from `openspec instructions` are constraints for the author — they must not be copied into the artifact file itself. Always read completed dependency artifacts before writing a new one.

## Layout

- `docs/prd/` — Product Requirements Documents (one file per feature)
- `openspec/changes/` — in-flight change proposals; `archive/` holds completed ones
- `openspec/specs/` — committed specifications (currently empty)
- `.claude/commands/opsx/` — the `/opsx:*` slash command definitions
- `.claude/skills/openspec-*/` — supporting skills referenced by the commands

## Conventions

- Change names are **kebab-case** (e.g. `add-route-schema`, not `Add Route Schema`)
- The data domain is **GTFS** ([General Transit Feed Specification](https://gtfs.org/schedule/reference/)) — its `agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt` schema is the source of truth for any modelling decisions
- Primary language is **Spanish**, split by audience — see below.

### Language by audience

| Layer | Audience | Language | Examples |
|---|---|---|---|
| Product narrative | Stakeholders (Intendencia, operadores, owner) | **Spanish** | `docs/prd/*.md`, `README.md`, `data/README.md`, `deployment/README.md`, `tooling/README.md` |
| Change rationale | Stakeholders + tech lead | **Spanish** | `openspec/changes/<name>/proposal.md`, `openspec/changes/<name>/design.md` |
| Formal contract | Engineers + `openspec validate` parser | **English** | `openspec/specs/<cap>/spec.md`, `openspec/changes/<name>/specs/**/*.md` |
| Implementation checklist | Engineers executing apply | **English** | `openspec/changes/<name>/tasks.md` |
| English mirrors | International readers | **English** | any `<name>.en.md` file |

**Why specs and tasks stay English** even though the rest of the repo is Spanish: their content is dominated by English technical vocabulary (RFC 2119 keywords `SHALL`/`MUST`/`SHALL NOT` parsed by `openspec validate`; GTFS field names like `agency_id`/`route_short_name`/`stop_times.txt`; structural markers `### Requirement:` / `#### Scenario:` / `**WHEN**` / `**THEN**`; JSON keys; GraphQL types; file extensions; Docker/CI commands). An audit of translated specs showed that even after rewriting the prose to Spanish, English tokens still outnumbered Spanish ones — the conectoras-in-Spanish-around-English-keywords hybrid was harder to read than either language pure. So: specs and tasks read like RFCs (English with technical jargon); proposals and designs read like product memos (Spanish, conversational).

**English mirrors:** for narrative docs in Spanish, the English translation lives next to the original as `<name>.en.md` (BCP-47 locale suffix, dot-separated). Cross-link the two with a header like `**Español** · [English](README.en.md)`. Use plain text, **not** flag emojis — flags don't represent languages cleanly. Spec files do not get `.en.md` mirrors (the spec itself is already English).

**Inside a Spanish doc:** technical identifiers stay in their original form — never translate `gtfs.zip`, `stop_times`, `direction_id`, command names, library names, etc. Code blocks are always literal.

## Product guardrails (from the v0 PRD)

Durable constraints that survive any individual feature. See [`docs/prd/mvp-v0.md`](docs/prd/mvp-v0.md) for the full context.

- **The viewer mimics Google Maps Transit.** Any UI divergence from Google Maps patterns (search bar position, FAB placement, itinerary card layout, polyline conventions) must be justified explicitly. The destino final is for the experience to be indistinguishable in feel from Google Maps when it routes by bus in another city. (PRD §5.1)
- **Trip planning is OTP, locally.** OpenTripPlanner 2 in Docker is the planning engine. No dependency on Google Directions or Transit Partners in runtime. Google Maps is only the canvas (rendering + Places autocomplete). (PRD §5.3)
- **GTFS-RT comes from our bridge, not from the operator directly.** The bridge polls Sol Antigua's AVL XML, matches markers against GTFS, and exposes the GTFS-RT `.pb` endpoints that OTP consumes. The AVL endpoint itself is never exposed publicly. (PRD §6.1, §6.4)
- **Static GTFS lives in `data/` as `.txt` files**, maintained manually. There is no `gtfs-builder` in this repo — the capture/processing infra is external and private. (PRD §3.2, §6.2)
- **Disclaimers are first-class UI elements**, not errors to hide. v0 trigger is demo-ready *cerrado*; disclaimers (tarifas a confirmar, datos preliminares, operador no oficial) live visibly in chrome persistente. (PRD §5.2)
- **UI is Spanish-only in v0, with i18n keys from day 1.** All user-facing strings go through `t("key")` even though there is one locale file. Adding `en.json` / `pt.json` later must be additive only — never a refactor. Operator data (stop names, headsigns) stays in Spanish always; do not translate topónimos. (PRD §5.4)
