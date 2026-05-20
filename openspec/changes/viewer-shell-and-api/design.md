## Context

El stack v0 ya entrega tres capabilities canónicas:

- [`gtfs-static-data`](../../specs/gtfs-static-data/spec.md) — feed estático determinístico.
- [`otp-routing`](../../specs/otp-routing/spec.md) — motor de planning sobre el feed, GraphQL en `POST /otp/gtfs/v1`, sin host port.
- [`bridge-gtfs-rt`](../../specs/bridge-gtfs-rt/spec.md) — service NestJS que poolea el AVL del operador y expone GTFS-RT en `/gtfs-rt/{vehicle-positions,trip-updates}.pb` + `/healthz`, sin host port.

Esta capability cierra el ciclo: el **único service del stack v0 con host port mapping**, el que (a) sirve la UI del viewer y (b) traduce el GraphQL de OTP a una superficie REST para el cliente. Es la consolidación de lo que el PRD §6.1 originalmente listaba como dos services (BFF Express + viewer HTML/JS) en uno solo (Next.js app).

Constraints heredados:

- **PRD §5.1**: Mimetizar Google Maps Transit. El viewer es UI-heavy (map canvas, itinerary cards, bottom sheets). Un framework React con SSR-capable es buen fit.
- **PRD §5.4**: Español-only en v0, i18n por keys desde día 1. Sumar `en.json` / `pt.json` después debe ser additivo.
- **PRD §5.5**: Mobile-first.
- **PRD §6.4**: Producto público, sin auth en v0.
- **PRD §8.1 AC#10**: `docker compose up` arranca el stack completo en <5 min.
- **OTP 2.10 no expone `vehiclePositions`** como top-level GraphQL field — verificado durante el smoke del bridge. Live vehicles van directo del `.pb` del bridge, no por OTP.

## Goals / Non-Goals

**Goals:**

- Un Next.js app arrancable con `docker compose up viewer` (que cablea `otp` + `bridge` como `depends_on`).
- Superficie REST chica y opinada que el frontend consume sin tener que conocer GraphQL ni protobuf: `POST /api/plan`, `GET /api/stops/:id/arrivals`, `GET /api/lines/:id`, `GET /api/lines/:id/vehicles`, `GET /api/healthz`, + stubs `/api/tickets` y `/api/pois`.
- Shell del viewer con chrome persistente: header de branding + disclaimer banner visible (PRD §5.2). Layout responsive mobile-first.
- Infra i18n por keys desde día 1, con un solo locale `es` en v0. Sumar `en.json` después es agregar un archivo + tocar el LocaleSwitcher.
- Validación de input con `zod` — el frontend puede mandar cualquier cosa, las API routes rechazan con `400` shape consistente.
- Degradación graciosa: cuando OTP o el bridge están caídos, los endpoints toleran lo que pueden y devuelven `meta.realtime_available: false` o `502` según el caso (mismo modelo que el viejo BFF spec).
- Tests unitarios via TDD sobre los traductores REST↔GraphQL, el decoder protobuf, el cache, y los componentes de chrome. Smoke CI end-to-end sobre el stack completo.

**Non-Goals:**

- **Pages de feature del viewer** — OD mode (con map + Places autocomplete), stop info mode (bottom sheet con next buses), line schedule mode (route + vehicles live). Specs siguientes (`viewer-od-mode`, etc.).
- **Carga del SDK de Google Maps JS** — entra con `viewer-od-mode`.
- **Autenticación, rate limiting, observabilidad pesada** — demo cerrado v0.
- **WebSocket / SSE push** — el frontend va a poll-ear los endpoints; decisión del spec del modo correspondiente.
- **Server Actions o tRPC** para typed RPC entre client y server — los endpoints son REST + zod validation. Más simple y greppable.
- **Multi-locale en v0** — un solo locale `es`. La infra está, los archivos extras NO.
- **Caching del lado del cliente** (SWR, react-query, etc.) — decisión de cada modo del viewer. Acá solo cacheamos del lado server, donde tenemos contexto.

## Decisions

### D-01 — Ubicación del código: `viewer/` en la raíz del repo

**Decisión:** `viewer/` al lado de `bridge/`, `tooling/`, y `deployment/`. Workspace Next.js standalone con su propio `package.json`, `tsconfig.json`, y `node_modules`. El compose lo construye vía `Dockerfile` local.

**Por qué `viewer/` y no `web/` o `app/`:**

- Misma convención top-level del repo — cada carpeta de raíz es un service o capa.
- Preserva el wording del PRD ("viewer turístico de Colonia") aunque el viewer ahora incluya API routes.
- "App" sería ambiguo (la app entera del stack o el `app/` directory de Next.js).
- "Web" no captura que también sirve API.

### D-02 — Stack: Next.js 16 + React 19 + TypeScript + Zod (resuelve PRD §10.1 Q4)

**Decisión:** Pin de deps runtime principales:

| Dep | Para qué |
|---|---|
| `next` (16.x estable al apply) | Framework: App Router, API routes, SSR, static optimization |
| `react` 19.x + `react-dom` 19.x | Library |
| `next-intl` | i18n por keys con App Router native, type-safe (resuelve Q5) |
| `zod` | Validación de bodies + query params en las API routes |
| `axios` | HTTP client para llamar a OTP y al bridge (consistente con bridge spec) |
| `gtfs-realtime-bindings` | Decode del `.pb` del bridge en `GET /api/lines/:id/vehicles` |

Dev: `typescript` (6.x), `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, `eslint`, `prettier`, `supertest` (para tests de API routes via node:http handler).

**Por qué Next.js App Router y no Pages Router:**

- App Router es el path oficial recomendado por el equipo de Next.js desde 14.x.
- Server Components by default permite responder con el shell SSR-ed sin shipping React al cliente para componentes estáticos (chrome, disclaimer banner).
- API routes via `route.ts` files es más explícito que el `pages/api/` legacy.
- `next-intl` tiene first-class App Router support.

**Por qué `next-intl` y no `next-i18next` o `react-intl`:**

- `next-intl` está construido para App Router (Server Components-aware), TypeScript first.
- `next-i18next` requiere el Pages Router y un setup más viejo.
- `react-intl` (formatjs) es framework-agnóstico pero pesado y menos idiomático con App Router.
- Custom 30-LOC era una opción del PRD §10.1 Q5 — descartada porque sumar segundo locale después requeriría hand-rolling el split de catálogos. `next-intl` lo da gratis.

**Por qué React 19:** estable, default de Next.js 15+/16.x. No hay razón para pin a 18.

### D-03 — Node 26, imagen `node:26-alpine` (mismo pin que el bridge)

**Decisión:** `node:26.1.0-alpine3.23` en el `Dockerfile`, `engines.node: "26.x"` en `package.json`. Multi-stage build:

1. `deps` stage: `npm ci` con `package-lock.json`.
2. `build` stage: copia `deps` + source, corre `next build` (genera `.next/standalone`).
3. `runtime` stage: solo `.next/standalone` + `.next/static` + `public/` + `bin/healthcheck.js`. Imagen final delgada.

**Por qué:** consistencia con el bridge — un solo Node major en producción. Standalone build de Next.js minimiza el tamaño del runtime (~80 MB vs ~250 MB de un build no-standalone).

### D-04 — Layout del repo (Next.js App Router)

**Decisión:**

```
viewer/
├── app/
│   ├── layout.tsx              Chrome persistente + i18n provider
│   ├── page.tsx                Placeholder mínimo (los modos llegan en specs siguientes)
│   ├── globals.css             Tailwind o CSS-modules base
│   └── api/
│       ├── plan/route.ts
│       ├── stops/[stopId]/arrivals/route.ts
│       ├── lines/[lineId]/route.ts
│       ├── lines/[lineId]/vehicles/route.ts
│       ├── tickets/route.ts
│       ├── pois/route.ts
│       └── healthz/route.ts
├── components/
│   ├── chrome/Header.tsx       Branding header
│   └── chrome/DisclaimerBanner.tsx
├── lib/
│   ├── otp/client.ts           HTTP client + sanitization (sin URL en errores)
│   ├── otp/queries.ts          Template strings GraphQL
│   ├── otp/translate-plan.ts   Respuesta GraphQL → REST shape
│   ├── otp/translate-arrivals.ts
│   ├── otp/translate-line.ts
│   ├── bridge/client.ts        HTTP client al bridge
│   ├── bridge/decode-vehicles.ts
│   └── util/ttl-cache.ts
├── messages/
│   └── es.json                 Strings v0 (es-only)
├── i18n/
│   └── routing.ts              next-intl routing config
├── test/
│   └── fixtures/{otp,bridge}/
├── bin/healthcheck.js
├── public/                     Assets estáticos (favicon, etc)
├── package.json
├── tsconfig.json
├── next.config.ts
├── Dockerfile
├── README.md
└── README.en.md
```

**Por qué dividir `lib/`:** los traductores REST↔GraphQL son lo único que requiere ser testeable en aislamiento de la HTTP layer. `app/api/<route>/route.ts` queda fino: parsea con zod, llama al traductor, devuelve.

### D-05 — GraphQL queries de OTP como template strings constantes (heredado del viejo BFF design D-04)

**Decisión:** En `lib/otp/queries.ts` viven los queries GraphQL como constantes. Cada API route tiene exactamente uno asociado. Sin codegen, sin GraphQL client framework. Mismo rationale que el viejo BFF spec.

### D-06 — `GET /api/lines/:id/vehicles` decodifica el `.pb` del bridge directo (heredado del viejo BFF design D-05)

**Decisión:** Mismo path que el viejo BFF spec — OTP 2.10 no expone `vehiclePositions` GraphQL, entonces este endpoint fetcha `BRIDGE_BASE_URL + /gtfs-rt/vehicle-positions.pb` directo y filtra por `lin == lineId`. Decodifica con `gtfs-realtime-bindings`.

### D-07 — Caching: solo static data, TTL 60 s (heredado del viejo BFF design D-06)

**Decisión:** `Map<string, { value, expiresAt }>` in-memory para `(lineId, date)` y `stops:list`. Plan / arrivals / vehicles **no se cachean** (time-sensitive). Mismo rationale que el viejo BFF spec.

Implementación: `lib/util/ttl-cache.ts` con clock inyectable. La cache vive en el proceso del Next.js server — si Next.js spawneara workers (no debería para v0), el cache estaría duplicado pero TTL corto lo mitiga.

### D-08 — Degradación graciosa por endpoint (heredado del viejo BFF design D-07)

**Decisión:** Mismo split que el viejo BFF spec — `/api/plan`, `/api/stops/:id/arrivals`, `/api/lines/:id` devuelven `502` si OTP no responde; `/api/lines/:id/vehicles` y `/api/healthz` toleran bridge down con `meta.realtime_available: false`.

### D-09 — i18n con `next-intl` + un solo locale `es` en v0 (resuelve PRD §10.1 Q5)

**Decisión:** Setup base de `next-intl`:

- `i18n/routing.ts` declara `locales: ['es']`, `defaultLocale: 'es'`.
- `messages/es.json` contiene todas las strings user-facing.
- El layout root mete `<NextIntlClientProvider>` para el cliente.
- Hooks `useTranslations()` en client components, `getTranslations()` en server components.
- `LocaleSwitcher` component existe pero con un solo locale es no-op visual (no aparece o aparece disabled — decisión apply-time).

**Por qué un solo locale en v0:** PRD §5.4. Sumar `en.json` y `pt.json` en v0.1+ es:

```bash
cp messages/es.json messages/en.json
# editar messages/en.json con traducciones
# actualizar i18n/routing.ts: locales: ['es', 'en']
```

Cero refactor en el código de componentes.

### D-10 — Chrome persistente: Header + DisclaimerBanner

**Decisión:** Dos componentes mínimos en `components/chrome/`:

- `Header.tsx`: branding "colonia-gtfs", LocaleSwitcher placeholder. Sticky top.
- `DisclaimerBanner.tsx`: banner persistente arriba o abajo con el contenido literal de PRD §5.2: "Datos preliminares · operador no oficial · tarifas a confirmar". Cerrable por sesión? **No** en v0 — siempre visible (PRD §5.2: "disclaimers son ciudadanos de primera, no errores que esconder").

`app/layout.tsx` los inserta entre `<NextIntlClientProvider>` y `{children}`. Todas las pages de feature heredan el chrome.

### D-11 — Stubs `/api/tickets` y `/api/pois`: 501 con body documentado (heredado del viejo BFF design D-09)

**Decisión:** Mismo body que el viejo BFF design — `501 Not Implemented` con `{ error, message, spec }` apuntando al spec post-archive.

### D-12 — Healthz agregado del stack (heredado del viejo BFF design D-10)

**Decisión:** `GET /api/healthz` agrega BFF (uptime, node version, `next` version) + OTP + bridge `/healthz` downstream. Mismo modelo y reglas (ok / degraded / down) que el viejo BFF design.

### D-13 — CORS: configurable via env, **off por default**

**Decisión:** En v0, el viewer y las API routes viven en el mismo origin (Next.js sirve ambos). No se necesita CORS en production. Para dev (Next.js dev server en `:3000`, OTP/bridge en `:8080/:3001`), Next.js dev mode no requiere CORS porque el mismo dev server sirve los API routes.

Si en algún momento la app pasa a multi-origin (CDN para frontend, BFF separado), `VIEWER_CORS_ORIGINS` env var existe pero por default está vacío y el middleware CORS no se monta. Mismo modelo que el viejo BFF design D-08.

**Diferencia con el viejo BFF spec:** acá CORS es estrictamente opcional, porque la unificación elimina el caso típico de "viewer en otro origin que el BFF".

### D-14 — TDD vía `superpowers:test-driven-development` (heredado del viejo BFF design D-11)

**Decisión:** Misma disciplina que el bridge y el viejo BFF. Test-first para cada traductor, decoder, handler, y componente de chrome. `vitest` como runner (más rápido que `jest` y nativo a Vite ecosystem). `@testing-library/react` para componentes.

API routes se testean con un wrapper `supertest`-like sobre `node:http` que usa el handler exportado por `route.ts`.

### D-15 — CI: dos workflows (lint+test + smoke E2E stack completo)

**Decisión:** Igual que el patrón del bridge:

- `.github/workflows/viewer.yml` — lint + vitest + `next build`. Triggers en push/PR sobre `viewer/**`.
- `.github/workflows/viewer-smoke.yml` — stack completo en fixture mode. setup-node 26, setup-java 21, uv. `docker compose up -d otp bridge viewer` con `ORIGIN_AVL=file://./bridge/test/fixtures/avl-sample.xml`. Poll `/api/healthz` hasta `ok|degraded`. Hit `/api/plan`, `/api/lines/4`, `/api/lines/4/vehicles`. Asserta shapes. Sube `smoke-out/` como artifact.

Smoke NO referencia `secrets.ORIGIN_AVL` (fixture mode only — herencia del contract de `bridge-gtfs-rt` R-03).

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Next.js bumpea major y rompe app Router conventions** | Pin de versión en `package.json`. Bumps via PR + el smoke detecta breaking changes. v0 vive 6 meses; Next.js major bumps son ~12 meses. |
| **OTP 2.x cambia GraphQL schema** | Queries pineados como template strings en `lib/otp/queries.ts`. Bump de OTP → tests del traductor (contra fixture committed) fallan loud. |
| **Bundle size del Next.js standalone** | Standalone build deja solo lo necesario. Si crece, usar `output: 'standalone'` + `outputFileTracingExcludes` para excluir deps innecesarias. Target inicial: <100 MB image. |
| **i18n type safety** | `next-intl` ofrece typed messages via `MessageKeys`. Los components que usen `t("key")` con una key que no existe en `messages/es.json` fallan en compile. |
| **Server Component vs Client Component confusion** | Convención: API routes y layout son server (default); components con interacción (LocaleSwitcher) son `"use client"`. Documentado en `viewer/README.md`. |
| **El viewer container hace double-duty (frontend + API) — saturación si traffic alto** | Demo cerrado v0. Para v0.1+ público con load mayor, sumar un load balancer o desdoblar API routes a un service aparte (decisión futura, no v0). |

## Migration Plan

No aplica: creación inicial del Next.js app + replacement conceptual del BFF Express que se había propuesto en #19 (cerrado).

Cuando se aplique:

1. Crear `viewer/` con la app Next.js, tests, `Dockerfile`, `README.md` + `.en.md`.
2. Sumar el service `viewer` al `docker-compose.yml` raíz, con `ports: "${VIEWER_PORT:-8080}:8080"` y `depends_on: { otp: { condition: service_healthy }, bridge: { condition: service_healthy } }`.
3. Actualizar `.env.example` con nuevas env vars.
4. Sumar workflows `viewer.yml` y `viewer-smoke.yml`.
5. Actualizar root `README.md` + `deployment/README.md` con el diagrama del stack final (3 services: otp + bridge + viewer).
6. **Quitar** el host port mapping de OTP en `compose.override.yml.example` (ya cubierto por el viewer; OTP queda interno).
7. **Actualizar el PRD** (`docs/prd/mvp-v0.md`) — §3.3, §6.1, §6.3, §6.4, §10.1 Q4+Q5, §11. Per la sección "Updates al PRD" del proposal.

## Open Questions

Tres preguntas que se resuelven durante apply o en specs siguientes:

- **Estructura de `messages/es.json`**: ¿flat (todas las keys top-level) o nested (por feature)? Lean nested — `messages/es.json` con `{ chrome: { ... }, plan: { ... }, lineSchedule: { ... } }` escala mejor cuando los modos del viewer agreguen keys.
- **Si el placeholder de `app/page.tsx` debe servir como landing o redirect a `/plan`**: probablemente un landing minimal centrado con disclaimer + título "Próximamente: viajes en bus en Colonia". Decisión de apply.
- **Si el `/api/healthz` aggregator del viewer debe replicar la shape exacta del bridge healthz o devolver una agregación más opinada**: lean por agregación opinada (mismo modelo que el viejo BFF spec D-10).
