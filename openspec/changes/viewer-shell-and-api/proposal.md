## Why

El PRD v0 ([`docs/prd/mvp-v0.md`](../../../docs/prd/mvp-v0.md) §6.1) listaba **dos services** user-facing del stack: un BFF Express y un viewer HTML/JS aparte. La propuesta original [`bff-api-and-routes`](https://github.com/manufarfaro/colonia-gtfs/pull/19) (cerrada sin mergear) reflejaba ese split. Al revisar la decisión arquitectónica antes de implementar, decidimos **colapsar ambos en un solo Next.js app**: un container, un repo de TypeScript, typing end-to-end entre frontend y API routes, y resuelve simultáneamente la [Q4 del PRD §10.1](../../../docs/prd/mvp-v0.md#101-diferidas-al-openspec-siguiente-no-al-prd) ("viewer stack: Vite + Vanilla TS / Vite + React / Vite + Svelte") respondiendo "React vía Next.js (App Router)".

Esta capability cubre la base unificada: las API routes que reemplazan al BFF + el **shell del viewer** (layout, chrome persistente, disclaimer banner, language toggle preparado, infra i18n). Los modos del viewer (`viewer-od-mode`, `viewer-stop-info-mode`, `viewer-line-schedule-mode`) construyen pages encima de esta base.

## What Changes

### Arquitectura

- Reemplazar la dupla BFF + viewer del PRD §6.1 con un único Next.js app en `viewer/` raíz del repo.
- **Único service del stack v0 con host port mapping** — el Next.js app es el entry point público.
- `otp` y `bridge` siguen en la red interna de Docker (per sus specs respectivos).

### API routes (lo que era el BFF)

5 endpoints + 2 stubs + healthz agregado, todos como `app/api/<route>/route.ts` en Next.js:

- `POST /api/plan` — traduce a la GraphQL `plan` query de OTP.
- `GET /api/stops/:stopId/arrivals` — próximos buses + ETAs (mix scheduled + RT).
- `GET /api/lines/:lineId` — trazado + paradas + horarios programados del día.
- `GET /api/lines/:lineId/vehicles` — decodea `/gtfs-rt/vehicle-positions.pb` del bridge, filtra por línea.
- `GET /api/healthz` — agregado BFF + OTP + bridge.
- `GET /api/tickets` y `GET /api/pois` — stubs `501` documentados.

### Shell del viewer

- **Layout root** (`app/layout.tsx`) con chrome persistente: header con título/branding, footer/banner del disclaimer ("Datos preliminares · operador no oficial · tarifas a confirmar", PRD §5.2).
- **Language toggle preparado**: el componente existe pero con un solo locale (`es`) en v0; sumar `en.json` / `pt.json` después es agregar archivos, no refactorizar (PRD §3.4, §5.4).
- **Infra i18n por keys** desde día 1 — toda string user-facing accede vía `t("key")`. **Resuelve Q5 del PRD §10.1** con `next-intl` (App Router native, type-safe, sumando locale extra es trivial).
- **Sin pages de feature todavía** — `app/page.tsx` es un placeholder mínimo (centered viewport con disclaimer + "Mapa de Colonia próximamente"). Los modos OD / stop-info / line-schedule son specs siguientes.
- Mobile-first responsive (PRD §5.5).

### Out of scope (explícito)

- **Páginas de feature del viewer** — `viewer-od-mode` (OD + Places autocomplete + itinerary card), `viewer-stop-info-mode` (bottom sheet con próximos buses), `viewer-line-schedule-mode` (vista de línea con vehicles live). Specs siguientes.
- **Google Maps JS API integration** — el sketch del mapa entra con `viewer-od-mode`. Acá ni se carga el SDK; solo el shell.
- **Implementación real de `/api/tickets` y `/api/pois`** — stubs `501` documentados.
- **SSR/SSG de pages de feature** — el shell page (`app/page.tsx`) puede ser estático trivial. Las pages de feature deciden su rendering en sus specs.
- **Auth / Authz** — PRD §6.4: producto público sin auth en v0.
- **Rate limiting** — demo cerrado.
- **WebSocket / SSE push** — el viewer va a poll-ear `/api/lines/:id/vehicles` cada N segundos (decisión del `viewer-line-schedule-mode` spec).
- **Server-side analytics** — PRD §4: out of v0.

### Updates al PRD

Esta capability cierra una decisión arquitectónica que estaba sub-especificada en el PRD. Como parte del apply, se actualiza:

- **§3.3 stack diagram** — colapsa "BFF + viewer" en "Next.js app".
- **§6.1 service table** — reemplaza las dos filas BFF + viewer por una sola (Next.js).
- **§6.3 flow diagram** — la línea "turista → viewer → BFF → OTP" pasa a "turista → Next.js → OTP / bridge".
- **§6.4 boundaries** — un solo container public-facing.
- **§10.1 Q4** — resuelta: "viewer stack: Next.js (App Router, React, TypeScript)".
- **§10.1 Q5** — resuelta: "i18n: `next-intl`".
- **§11 mapping** — las filas `bff-api-and-routes` + `viewer-shell-and-i18n` colapsan en una sola: `viewer-shell-and-api`.

## Capabilities

### New Capabilities

- `viewer-shell-and-api`: Next.js app unificado del v0. Cubre el shell user-facing (layout, chrome persistente, disclaimer banner, language toggle preparado, infra i18n) y las API routes que consumen OTP + bridge.

### Modified Capabilities

_Ninguna._ El Next.js app **consume** `otp-routing` (R-07 GraphQL) y `bridge-gtfs-rt` (R-05 `.pb` + R-07 healthz) sin modificarlos. Las capabilities siguientes del viewer construyen encima de esta sin modificarla.

## Impact

- **New files (al aplicar):**
  - `viewer/` (Next.js workspace): `package.json`, `tsconfig.json`, `next.config.ts`, `app/`, `components/`, `lib/`, `messages/es.json`, `test/`, `Dockerfile`, `README.md`, `README.en.md`, `bin/healthcheck.js`.
  - `viewer/app/api/{plan,stops,lines,tickets,pois,healthz}/route.ts` — API routes.
  - `viewer/app/layout.tsx` — chrome persistente + i18n provider.
  - `viewer/app/page.tsx` — placeholder mínimo.
  - `viewer/test/fixtures/{otp,bridge}/` — fixtures para los tests de los traductores.
  - `viewer/messages/es.json` — strings v0 (es-only por ahora).
  - `.github/workflows/viewer.yml` — lint + tests + build.
  - `.github/workflows/viewer-smoke.yml` — smoke E2E del stack completo.
- **Modified files (al aplicar):**
  - `docker-compose.yml` — sumar service `viewer` con `build: ./viewer`, `env_file: .env`, `ports: "${VIEWER_PORT:-8080}:8080"`, `depends_on: { otp: ..., bridge: ... }`. Único service con host port mapping.
  - `compose.override.yml.example` — quitar host port mapping de OTP (ya no necesario; el viewer es el frontend público).
  - `.env.example` — sumar `VIEWER_PORT=8080`, `OTP_BASE_URL=http://otp:8080`, `BRIDGE_BASE_URL=http://bridge:3001`, `VIEWER_CORS_ORIGINS=` (vacío default).
  - `README.md` / `.en.md` — badges + link a `viewer/README.md`. Actualizar sección "Stack" con el nuevo modelo (3 services: otp + bridge + viewer).
  - `deployment/README.md` / `.en.md` — diagrama del stack final (3 services, 1 puerto público).
  - `docs/prd/mvp-v0.md` — actualizaciones §3.3, §6.1, §6.3, §6.4, §10.1 Q4+Q5, §11 (per la sección "Updates al PRD" arriba).
- **Unblocks:**
  - `viewer-od-mode` — la base del Next.js app + API routes ya están; solo agrega `app/plan/page.tsx` (o similar) + componentes.
  - `viewer-stop-info-mode` — idem, agrega su page + componente bottom sheet.
  - `viewer-line-schedule-mode` — idem.
- **Consume:**
  - `otp-routing` R-07: GraphQL endpoint `POST /otp/gtfs/v1`.
  - `bridge-gtfs-rt` R-05: `GET /gtfs-rt/vehicle-positions.pb`.
  - `bridge-gtfs-rt` R-07: `GET /healthz`.
- **External runtime dependencies:**
  - Node.js 26 (mismo pin que el bridge).
  - npm packages: `next` (App Router), `react`, `react-dom`, `next-intl`, `zod`, `axios`, `gtfs-realtime-bindings`. Dev: `typescript`, `vitest`, `@testing-library/react`, `eslint`, `prettier`.
- **Open questions diferidas al `design.md`:**
  - Versión exacta de Next.js (15.x o 16.x, depende de qué esté Stable al apply).
  - React 19.
  - Estrategia exacta de SSR vs static para el placeholder `app/page.tsx`.
  - Approach de testing: dónde corre `vitest` vs Playwright/E2E (probablemente `vitest` para unit/route handlers, smoke en CI cubre E2E).
  - Si el static serve de los assets del map (cuando llegue) se hace desde Next.js o desde otro mount.
