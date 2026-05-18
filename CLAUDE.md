# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Unofficial GTFS feed for urban transit in Colonia del Sacramento, Uruguay. The repository currently contains no source code — only OpenSpec scaffolding for spec-driven development. New features begin as OpenSpec change proposals rather than ad-hoc commits.

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
- The README is bilingual (Spanish/English); user-facing copy in this repo follows the same pattern
