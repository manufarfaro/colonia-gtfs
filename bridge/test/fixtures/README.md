# `bridge/test/fixtures/` — Fixtures determinísticos del bridge

## `avl-mini.xml`

Captura sintética chica (2 markers, ISO-8859-1, 335 bytes) usada por los unit tests del parser (`avl-parser.spec.ts`) y del poller (`poller.service.spec.ts`).

**Sanitización aplicada:**

- IDs (`V42`, `V43`) son opacos — no son IDs reales del operador.
- Atributo `label` con acentuado ("Línea 4") presente intencionalmente para ejercitar el path de decoding ISO-8859-1.
- Sin URL real del upstream en el body.

## `avl-sample.xml`

Sample más amplio (8 markers cubriendo las 4 líneas × 2 direcciones, ~1.2 KB) usado por el workflow de smoke `bridge-rt-validate.yml`.

**Sanitización aplicada:**

- IDs `OPAQUE-001..008` — opacos, no son IDs operator-side.
- Coordenadas elegidas en/cerca del primer stop de un trip real de cada (route, dir), de modo que el matcher snapea consistente.
- Times pineados a `2026-06-02` (martes, weekday-service activo, sin coincidir con feriados UY) entre 07:30 y 08:35.
- Labels con un acentuado ("Línea 4") para preservar el path de encoding.
- Sin URL real del upstream en el body.

**Por qué un día pineado:** el matcher resuelve `service_id` desde `now` del bridge (no desde `marker.time`). Cuando el smoke corre en CI un fin de semana o feriado, los markers irán como unmatched — la respuesta `.pb` queda estructuralmente válida (entity[] vacío) y el validator pasa igual.

## `gtfs-mini/`

Mini-GTFS Schedule (1 route, 2 trips, 5 stops, 4 services + 1 holiday exception) usado por los unit tests del loader (`gtfs-static.service.spec.ts`) y del matcher (`matcher.service.spec.ts`). 100 % sintético, ningún dato real del operador.
