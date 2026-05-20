# `viewer/test/fixtures/` — Fixtures determinísticos del viewer

## `otp/`

GraphQL responses committeadas usadas por los tests de los traductores REST↔GraphQL en `lib/otp/`:

- `plan-response.json` — sample response del query `plan(...)`, usado por `lib/otp/translate-plan.test.ts`.
- `arrivals-response.json` — sample response de `stoptimesForServiceDate`, usado por `lib/otp/translate-arrivals.test.ts`.
- `line-response.json` — sample response del query `route(...)`, usado por `lib/otp/translate-line.test.ts`.

Los responses se capturan corriendo el query GraphQL real contra una instancia local de OTP con la production data del repo + sanitizados (sin operator-side credentials).

## `bridge/`

- `vehicle-positions.pb` — sample binario del `.pb` del bridge para los tests del decoder en `lib/bridge/decode-vehicles.test.ts`. Sanitizado (IDs opacos, sin URL real del operator upstream).

## Generación

Cuando los fixtures necesitan refresh (ej. OTP bumpea schema), los regenerás:

```bash
# Levantar el stack en modo fixture
docker compose up -d otp bridge

# Capturar plan
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"...","variables":{...}}' \
  http://localhost:8080/otp/gtfs/v1 \
  > viewer/test/fixtures/otp/plan-response.json

# Capturar vehicle positions del bridge
curl http://localhost:3001/gtfs-rt/vehicle-positions.pb \
  -o viewer/test/fixtures/bridge/vehicle-positions.pb
```

Después correr `viewer && npm test` y commitear el resultado si los traductores siguen verdes.
