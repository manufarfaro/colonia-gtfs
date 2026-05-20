# `viewer/` — Next.js app (viewer + API routes)

**Español** · [English](README.en.md)

Single Next.js 16 app (App Router) que combina dos responsabilidades del stack v0: la UI mobile-first que mimetiza Google Maps Transit y las API routes que orquestan OTP + bridge para el cliente. Es el único container del stack que expone puerto al host.

[![Viewer](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer.yml)
[![Viewer Smoke](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer-smoke.yml/badge.svg)](https://github.com/manufarfaro/colonia-gtfs/actions/workflows/viewer-smoke.yml)

## Stack

- **Next.js 16.x** (App Router, standalone output) + **React 19** + **TypeScript**.
- **shadcn/ui** + **Tailwind CSS v4** (CSS-first config, base color `neutral`).
- **next-intl** para i18n type-safe (locales declarados en `i18n/routing.ts`; `es` único en v0).
- **axios** como cliente HTTP de OTP y del bridge.
- **gtfs-realtime-bindings** para decodificar el feed protobuf del bridge.
- **zod** para validación de bodies en route handlers.
- **vitest** + **@testing-library/react** + **happy-dom** para tests (TDD-discipline; ver `test/`).

Node pin: **26.x** (alineado con bridge). `engines.node` en `package.json`.

## Boot

```bash
# 1. Asegurate de tener data/output/gtfs.zip (lo necesitan OTP y el bridge):
uv run --directory tooling python scripts/build_gtfs_zip.py

# 2. Levantá el stack completo (viewer + otp + bridge):
docker compose up viewer
```

El viewer queda en `http://localhost:${VIEWER_PORT:-8080}`. OTP y bridge solo son alcanzables vía red interna de Docker.

### Dev mode

```bash
cd viewer
npm install
npm run start:dev   # next dev en :3000 con hot-reload
```

En dev necesitás que OTP y el bridge estén corriendo (vía `docker compose up otp bridge`) y exportar las URLs:

```bash
export OTP_BASE_URL=http://localhost:8081     # si exponés OTP vía compose.override.yml
export BRIDGE_BASE_URL=http://localhost:3001  # si exponés bridge vía compose.override.yml
npm run start:dev
```

## Endpoints

| Route | Método | Propósito |
|---|---|---|
| `/` | GET | Landing — chrome persistente (header + disclaimer banner) + placeholder de la UI. |
| `/api/plan` | POST | Itinerario multi-modal. Body Zod: `{from:{lat,lon}, to:{lat,lon}, date, time}`. Traduce a GraphQL contra OTP. |
| `/api/stops/:stopId/arrivals` | GET | Próximas llegadas. Query `?limit=10` (clamp 1..50). Mezcla scheduled + realtime de OTP. |
| `/api/lines/:lineId` | GET | Datos completos de una línea (shape + directions + stops + scheduledDepartures). Cache TTL 60 s por `(lineId, date)`. |
| `/api/lines/:lineId/vehicles` | GET | Vehículos en vivo de la línea, decodificados del `vehicle-positions.pb` del bridge. Sin cache. |
| `/api/tickets` | GET | `501 not_implemented` (reservado para v0.1+). |
| `/api/pois` | GET | `501 not_implemented` (reservado para v0.1+). |
| `/api/healthz` | GET | Aggregate health del stack (viewer + otp + bridge). Status `ok` / `degraded` / `down`. |

Errores estandarizados: `400 invalid_request`, `404 *_not_found`, `502 otp_unavailable`. Las URLs internas de OTP y bridge nunca aparecen en bodies de error (sanitización en `lib/otp/client.ts` y `lib/bridge/client.ts`).

## Chrome persistente

`app/layout.tsx` envuelve toda página en `NextIntlClientProvider` + dos componentes que viven en todas las rutas:

- **`components/chrome/Header.tsx`** — Sticky top con el título de la app y el `LocaleSwitcher` (no-op visual mientras `locales.length === 1`).
- **`components/chrome/DisclaimerBanner.tsx`** — Banner persistente con el texto del PRD §5.2 (`"Datos preliminares · operador no oficial · tarifas a confirmar"`). Sin botón de cierre — los disclaimers son ciudadanos de primera, no errores que esconder.

## i18n

Una sola locale en v0 (`es`), pero el cableado de `next-intl` ya está armado para que sumar `en.json` / `pt.json` sea aditivo:

- `i18n/routing.ts` declara `locales: ['es']`, `defaultLocale: 'es'`.
- `i18n/request.ts` resuelve los messages para cada request.
- `messages/es.json` tiene las claves seed (`chrome.*`, `landing.*`). Toda string user-facing pasa por `t("...")` desde día uno — agregar idiomas no requiere refactor.

Los toponímicos del operador (nombres de paradas, headsigns) **no se traducen** — viven en `data/*.txt` siempre en español.

## CORS

`middleware.ts` (root del workspace) aplica headers CORS a `/api/*` cuando la env `VIEWER_CORS_ORIGINS` lista orígenes explícitos (separados por coma). `""` (vacío) → no expone CORS; `"*"` → ignorado con warning (el cliente y el BFF viven en el mismo origen en v0).

## Tests

`npm test` corre la suite completa (vitest). Disciplina TDD: cada handler / translator / utility se acompaña de su test bajo `*.test.ts` co-localizado. Fixtures determinísticos en `test/fixtures/otp/` (GraphQL JSON) y `test/fixtures/bridge/` (`vehicle-positions.pb` generado por `generate.mjs`).

## Healthcheck

`bin/healthcheck.js` es un probe Node puro (la imagen `node:26-alpine` no trae `curl`/`wget`). Abre socket TCP contra `/api/healthz`, parsea el JSON, considera el container sano cuando `status` es `ok` **o** `degraded` (mismo principio que el bridge — `degraded` sigue siendo un container vivo, solo sin RT).

## CI

- **[`viewer.yml`](../.github/workflows/viewer.yml)** — lint + vitest + `next build` en cada PR que toca `viewer/**`.
- **[`viewer-smoke.yml`](../.github/workflows/viewer-smoke.yml)** — boot del stack completo (otp + bridge en fixture mode + viewer), poll de `/api/healthz`, hits reales a `/api/plan`, `/api/lines/4`, `/api/lines/4/vehicles`, y assert que el HTML de `/` contiene la copia del disclaimer.

## Spec

El contrato verificable vive en [`openspec/specs/viewer-shell-and-api/spec.md`](../openspec/specs/viewer-shell-and-api/spec.md) (post-archive del change). Mientras el change está in-flight: [`openspec/changes/viewer-shell-and-api/`](../openspec/changes/viewer-shell-and-api/).
