# PRDs

**Español** · [English](README.en.md)

Acá viven los PRDs (Product Requirements Documents) del proyecto. Cada PRD describe una capacidad del producto: el *qué* y el *por qué*. Los specs de OpenSpec (en [`../../openspec/`](../../openspec/)) traducen esos PRDs al *cómo*, y el código implementa los specs.

## Convenciones

- Un archivo por PRD, en kebab-case: `<feature>.md` (ej. `route-schedule-feed.md`).
- Cada PRD se escribe en español; si necesitás versión en inglés agregá `<feature>.en.md` al lado.
- Antes de escribir un spec, leé el PRD que lo motiva.

## Índice

- [`mvp-v0.md`](./mvp-v0.md) — Trip planner turístico de Colonia: O→D + stop info + line schedule sobre Google Maps JS, planning local con OTP, realtime vía bridge sobre AVL Sol Antigua. Trigger demo-ready cerrado.
