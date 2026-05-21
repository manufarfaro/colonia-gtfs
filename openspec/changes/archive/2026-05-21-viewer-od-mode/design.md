## Context

El stack v0 ya tiene los servicios cableados ([`otp-routing`](../../specs/otp-routing/spec.md), [`bridge-gtfs-rt`](../../specs/bridge-gtfs-rt/spec.md), [`viewer-shell-and-api`](../../specs/viewer-shell-and-api/spec.md)). El `/api/plan` traduce GraphQL del OTP a una shape REST con `itineraries[].legs[]` (mode, route, from, to, duración, distancia, horarios) — pero **sin geometría** de cada leg. La página `/` del Next.js app es un placeholder centrado con `landing.title` + `landing.subtitle`.

Este change cierra el gap entre "tenemos el motor" y "el turista puede planear el viaje". Es la primera de tres modalidades del viewer (OD, stop-info, line-schedule) y la única que es entry point por default — el destino canónico del PRD ([§2.2](../../../docs/prd/mvp-v0.md#22-caso-de-uso-canónico) "turista en Buquebus saca el celular").

**Stakeholders:**
- Turista (audiencia primaria PRD §2.1): celular, una mano, conexión móvil.
- Operador (Sol Antigua): no consume directo, pero un demo limpio facilita la conversación de la tarifa + el endorsement.
- Tech lead: el código tiene que mantenerse simple (un solo modo, no abstracción prematura para los tres modes futuros).

**Restricciones:**
- **Google Maps es canvas, no engine.** Sin Directions API, sin Transit Partners ([PRD §5.3](../../../docs/prd/mvp-v0.md#53-local-first-en-el-motor-de-planning)).
- **Mimetizar Google Maps Transit.** UX patterns: search bar arriba, mapa full-bleed, bottom sheet con itinerario ([PRD §5.1](../../../docs/prd/mvp-v0.md#51-mimetizar-google-maps-transit)).
- **Mobile-first.** La pantalla canon es un Buquebus con un celular ([PRD §5.5](../../../docs/prd/mvp-v0.md#55-mobile-first)).
- **Spanish + i18n key-by-key.** Toda string via `t()` desde día 1 ([PRD §5.4](../../../docs/prd/mvp-v0.md#54-ui-en-español-infraestructura-i18n-por-keys)).
- **No leak del API key.** El key de Google Maps es público (HTTP referrer restriction en GCP). Documentar pero no rotear nunca por backend.
- **OTP devuelve duraciones largas como Long.** El traductor existente ya las maneja (`Number(...)`).

## Goals / Non-Goals

**Goals:**
- `/` muestra mapa + barra de búsqueda + (cuando hay resultado) card del itinerario.
- Origen + destino se eligen vía Places Autocomplete sesgado a bbox de Colonia.
- Al confirmar ambos, POST a `/api/plan` con `date: today, time: now+1min` y render del primer itinerary sobre el mapa.
- Card muestra duración total, walking distance, segmentos (walk + bus con shortName + tiempo), tarifa.
- Estados loading / empty / error con copy desde `messages/es.json`.

**Non-Goals (explícitos):**
- Multi-itinerary swiper (mostramos el primero del array; el array completo queda accesible en el response).
- Selector de hora futura ("salir 18:30 del jueves").
- Tap-on-stop / live ETAs por parada (eso es `viewer-stop-info-mode`).
- Vista por línea con todos los stops + vehicles live (`viewer-line-schedule-mode`).
- Persistencia del último viaje buscado.
- Render del mapa server-side. El mapa monta en client; el server-side de `/` rinde la chrome + estado de carga (skeleton).
- Tests con browser headless. v0 cubre todo con vitest + RTL (mockeando `@vis.gl/react-google-maps`); el smoke E2E real del map render queda para un follow-up con Playwright.

## Decisions

### D-01 — `@vis.gl/react-google-maps` como wrapper de Maps JS

**Decisión:** Usar `@vis.gl/react-google-maps` (mantained por Google's Visualization team) en lugar de `@googlemaps/js-api-loader` directo o el viejo `@react-google-maps/api`.

**Por qué:**
- Pin de Google, type-safe, soporte de Server Components nativo (`APIProvider` es client, los hijos pueden ser client también).
- Componentes idiomáticos React (`<Map>`, `<Marker>`, `<APIProvider>`) en vez de imperativo `new google.maps.Map(...)`.
- Lazy loading correcto del bundle (no bloquea First Paint).
- Acepta `libraries` prop para cargar `places` + `geometry` (necesarios para Autocomplete + polyline decode).

**Alternativas consideradas:**
- `@googlemaps/js-api-loader` directo: más control pero mucho boilerplate de useEffect/cleanup. No vale para v0.
- `@react-google-maps/api`: legacy, ya no se mantiene activamente; muchos issues abiertos sobre React 19.

**Trade-off:** Una dependencia más, ~12 KB gzipped. Aceptable.

### D-02 — Google Maps API key como `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

**Decisión:** La key se bundlea al cliente vía `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Restricción de seguridad: HTTP referrer en GCP Console (lista blanca con el dominio del demo + `localhost`).

**Por qué:**
- Maps JS API tiene que ejecutarse en el browser; no hay forma de ocultar la key sin proxy-eando todas las requests (mata el costo y el rendimiento).
- Es la práctica recomendada por Google para Maps JS.
- El "secreto" real es la restricción por referrer, no la key string.

**Cómo aplica:**
- `.env.example`: documentar la variable con un comment apuntando a la doc de restricción referrer.
- `viewer/README.md`: sección sobre cómo crear la key + agregar al `.env` (gitignored).
- `app/page.tsx`: lee la key vía `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (next.js la inlinea al bundle); si falta, render un fallback explícito ("Falta configurar la API key").
- **Nunca** loguear la key. Nunca commitearla.

### D-03 — `/api/plan` extiende con `legGeometry.points` (modifica `viewer-shell-and-api`)

**Decisión:** Agregar `legGeometry: { points: string } | null` a `RestLeg`. La query GraphQL existente (`PLAN_QUERY`) suma el campo `legGeometry { points }` que OTP 2.10 ya expone. Decodeado en cliente via `google.maps.geometry.encoding.decodePath(points)` → array de `LatLng` que se pasa al `<Polyline>`.

**Por qué:**
- Una sola request por search. Alternativa (segundo GET por leg para fetchear geometría) sería 1+N queries y latencia visible en mobile.
- OTP ya devuelve el encoded polyline — gratis.
- El campo es opcional (null) por compat con OTP que no siempre lo computa (igual que `patternGeometry` en line-query del [`viewer-shell-and-api` post-fix](../2026-05-20-viewer-shell-and-api/)).

**Cómo aplica:**
- Update `lib/otp/queries.ts` PLAN_QUERY: sumar `legGeometry { points }` al selector de leg.
- Update `lib/otp/translate-plan.ts`: sumar `legGeometry` al `RestLeg` y propagarlo del raw.
- Update fixture `test/fixtures/otp/plan-response.json` con un polyline string corto en cada leg.
- Update tests del traductor + del route handler.

### D-04 — Places Autocomplete sesgado a Colonia urbano (bbox)

**Decisión:** Restringir el Autocomplete a un rectángulo lat/lon que cubre Colonia urbano:
- SW: `-34.490, -57.870`
- NE: `-34.435, -57.800`

Más `componentRestrictions: { country: 'uy' }`.

**Por qué:**
- Sin restricción, "Plaza" sugiere Plaza Independencia de Buenos Aires.
- El bbox cubre Colonia + Real de San Carlos + ruta a Buquebus + barrios del este (Tres Tradiciones, El General). Coincide con el OSM extract de [`gtfs-static-data` R-04](../../specs/gtfs-static-data/spec.md).

**Cómo aplica:**
- `lib/google-maps/places-options.ts` exporta el bbox como constante.
- Cualquier suggestion fuera del bbox queda filtrada por la API de Places (no se renderiza).

### D-05 — Time pinning: "now + 1 min"

**Decisión:** Por default la query es `date: today, time: now + 1 min` en TZ Montevideo (`America/Montevideo`). El "+1 min" deja margen para que OTP no busque buses que ya pasaron.

**Por qué:**
- v0 es demo-ready: el caso real es "ahora, llevame".
- Selector de hora futura es UX adicional que duplica el componente — diferido a v0.1+.
- Time pinning del CI smoke (miércoles 14:00) se mantiene como override server-side, no afecta este modo.

### D-06 — Layout mobile-first: search bar sticky-top + bottom sheet

**Decisión:** Layout:
- **Map**: `position: fixed; inset: 0` (full-bleed), `z-index: 0`.
- **Header chrome** (del shell, sticky top): se mantiene, ya tiene el LocaleSwitcher + ThemeToggle.
- **Search bar OD**: debajo del header, sticky `top-14` (h-14 del header). Dos inputs apilados (origen / destino), separador, "Buscar" implícito al confirmar ambos.
- **Bottom sheet con itinerary card**: cuando hay resultado, slide up desde el bottom, ocupa ~40% del viewport altura inicial, dragable a expand a ~75%.
- **Disclaimer banner** (del shell): se mantiene siempre visible al fondo.

Sin route adicional (`/plan`, `/results`) — todo es client-state en `/`. Hash routes opcionales para deep-link en futuras versiones.

**Por qué:**
- Mimetiza Google Maps Transit casi 1:1.
- Mobile-first: no hay sidebars ni paneles laterales.
- Single page, single state — fácil de razonar.

### D-07 — Colores de polyline por mode

**Decisión:**
- `walk`: gris (#6b7280), `strokeOpacity: 0.6`, dashed pattern (icons + repeat).
- `bus`: color por línea — paleta v0 hardcodeada en `lib/colors/lines.ts`:
  - Línea 3: `#ef4444` (rojo)
  - Línea 4: `#3b82f6` (azul)
  - Línea 5: `#22c55e` (verde)
  - Línea 8: `#f59e0b` (ámbar)
  - Fallback (líneas sin asignar): `#6366f1` (indigo).

**Por qué:**
- Google Maps usa colores específicos por línea cuando el GTFS los declara (`route_color` en routes.txt). Nuestro `data/routes.txt` no tiene `route_color` todavía — futuro sumarlo en `gtfs-static-data` follow-up.
- Por ahora, paleta hardcodeada legible + Tailwind-friendly. Cuando `route_color` aparezca, el helper toma el color del response (fallback a la paleta).

**Cómo aplica:**
- `lib/colors/lines.ts` exporta `getLineColor(shortName: string): string`.
- `<LegPolyline>` toma `mode` + `route` y resuelve estilo.

### D-08 — Tarifa: lectura del response + fallback

**Decisión:** El response de `/api/plan` devuelve `fares` (de OTP) si están declaradas en `fare_attributes.txt`. Card:
- Si `itinerary.fare.regular` viene poblado: `UYU $X`.
- Si viene `null` / ausente: "Consultar al chofer" (plan B [PRD §9](../../../docs/prd/mvp-v0.md#9-riesgos)).

**Por qué:**
- Per [PRD §8.1 #3](../../../docs/prd/mvp-v0.md#81-funcionalidad), la tarifa va en la card.
- Per [§7](../../../docs/prd/mvp-v0.md#7-dependencias-bloqueantes), la tarifa real es open dependency con Sol Antigua.
- El fallback nos deja shippear ahora sin bloquear por una conversación pendiente.

**Cómo aplica:**
- Extender el query OTP para incluir `fare { regular { cents, currency } }`.
- Update traductor.
- Update tests.

### D-09 — Estados de UI

**Decisión:** Cuatro estados explícitos en el client component:
1. `idle`: usuario aún no eligió ambos endpoints. Muestra search bar + map vacío + bottom sheet collapsed con hint ("Elegí origen y destino para ver opciones de viaje").
2. `loading`: ambos endpoints elegidos, plan request in-flight. Search bar disabled, skeleton del itinerary card, spinner en bottom sheet header.
3. `success`: itinerary renderizado (polyline en map, card en bottom sheet).
4. `error`: 502 OTP unavailable → "El servicio de planificación no está disponible. Reintentar en un minuto"; 400 invalid → "Origen y destino tienen que estar dentro de Colonia urbano"; sin itineraries → "No encontramos una opción de viaje para ese trayecto. Probá con un destino cercano".

Todas las copias en `messages/es.json`. Errores no surface-an URLs internas (cumple `viewer-shell-and-api` R-15 sanitization).

### D-10 — Convención de tests + coverage

**Decisión:** Mantener el 100% threshold del shell. Aproximaciones:
- **`MapCanvas` / `OdModeShell`**: mockear `@vis.gl/react-google-maps` (las primitivas `<APIProvider>`, `<Map>`, `<Marker>`, `<Polyline>` se reemplazan por wrappers que renderean sus props como atributos para asertarlos).
- **`usePlanQuery`**: mockear axios + assertar inputs/outputs.
- **Polyline color**: tests unitarios puros del helper.
- **`SearchBar` + `OriginDestinationInputs`**: testing-library con eventos `change`, assertar el callback de selección.

Excluir del coverage si no se puede testear razonablemente:
- Funciones que solo wrappean primitivas de Google Maps no testeables sin browser real.

Documentar las exclusiones en `vitest.config.ts` igual que las del shell (`components/ui/**`).

### D-11 — `app/page.tsx` server component que monta el client

**Decisión:** `app/page.tsx` se mantiene server-component, lee la API key del env, pasa al `<OdModeShell apiKey={...} />` (client component). Si la key falta, `<OdModeShell>` renderiza una banner de error explícita en lugar del mapa.

**Por qué:**
- Server-side rendering del shell mejora First Paint.
- La key viaja al cliente igualmente (es NEXT_PUBLIC_*) — no hay beneficio de seguridad de leerla server-side, solo organizativo.
- Tests pueden assertar el banner de error renderizando page con `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` undefined.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Google Maps API quota se agota durante la demo** | HTTP referrer restriction limita el blast radius; el quota free tier de Maps JS es generoso para un demo (28k loads/mes). Para uso productivo del v0.1 público sumar billing alerts en GCP. |
| **Places Autocomplete no encuentra el lugar exacto que el turista escribe** ("Buquebus") | El bbox cubre la terminal. Si Autocomplete falla, igual hay fallback: el usuario puede tap-on-map (futuro, fuera de scope) o escribir address completa. Para v0 demo lo verificamos en los casos canónicos del [PRD §8.1 #15](../../../docs/prd/mvp-v0.md#84-calidad-mínima). |
| **El polyline encoded de OTP no incluye granularidad suficiente y queda dentado en mobile** | OTP usa el algoritmo standard de Google; granularidad ~6 dígitos suficiente para zoom <=16. Si futuras pruebas muestran issues, OTP también tiene `legGeometry.length` para tunear. |
| **Tarifa no llega a tiempo + el fallback "Consultar al chofer" se ve unprofessional en la demo** | El disclaimer general ya prepara al usuario ("tarifas a confirmar"). El string explícito es honesto. Mitigación primaria sigue siendo cerrar la conversación con el operador antes del cierre del PR. |
| **Test coverage al 100% con código que toca Google Maps es caro** | El wrapper `@vis.gl/react-google-maps` es composable — los components que escribimos no llaman directamente al SDK global; reciben primitivas via children/props que se pueden mockear. Lo intestable (loader runtime) se excluye explícitamente. |
| **next build falla por importar `google` global en build time** | `@vis.gl/react-google-maps` usa `'use client'` correctamente; sus primitivas no se evaluan en el SSR pass. Tests del page con mocking. |

## Migration Plan

No hay breaking changes para usuarios. Sí hay un único cambio de contrato en el API:

- `/api/plan` response gana `itineraries[].legs[].legGeometry: { points: string } | null`. Es campo **aditivo** — clientes existentes (hay uno: el placeholder de la home, que vamos a reemplazar) no se rompen.
- `itineraries[].fare: { regular: { cents: number, currency: 'UYU' } } | null` — mismo principio aditivo.
- La página `/` cambia de placeholder a OD mode. Cualquier deep-link existente (no hay) seguiría funcionando.

Compose, env vars, secrets, CI: sin cambios disruptivos. Sumar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` al `.env.example` con el placeholder explícito.

## Open Questions

- **Q1 — `route_color` en `data/routes.txt`?** Si la operación canónica de Sol Antigua tiene colores oficiales por línea (vinilos del bus, mapa impreso del operador), sería propio del feed. Por ahora la paleta hardcodeada del D-07 es proxy. Resolvable en `gtfs-static-data` follow-up.
- **Q2 — ¿Qué hacer si OTP devuelve >5 itinerarios?** v0 muestra el primero; los otros viven en el response. Diferido a swiper post-v0.
- **Q3 — Persistencia de la búsqueda al refrescar (hash routing)?** Bueno para deep-links shareables. v0 sin esto; v0.1 si la demo lo pide.
