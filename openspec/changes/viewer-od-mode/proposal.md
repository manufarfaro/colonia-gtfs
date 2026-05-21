## Why

El criterio de aceptación #2 del [PRD v0](../../../docs/prd/mvp-v0.md#81-funcionalidad) — "el usuario escribe origen y destino, obtiene al menos una opción de itinerario con bus + walking legs" — es lo que define que el demo sea demo. Hoy el stack tiene todo lo necesario por debajo (OTP rutea, el bridge alimenta GTFS-RT, el viewer expone `/api/plan` y la chrome persistente con el disclaimer), pero la página `/` es un placeholder centrado. Falta la pantalla mobile-first donde el turista escribe "Terminal Buquebus Colonia" → "Plaza de Toros" y ve la opción de bus dibujada sobre el mapa, igual que en Google Maps cuando rutea con modo Transit en otra ciudad. Este es el modo "O→D" del [PRD §11](../../../docs/prd/mvp-v0.md#11-próximos-pasos) y el camino más corto a v0 demo-ready.

## What Changes

- **Reemplazar `/` (landing placeholder) por el modo O→D.** La home pasa a ser un layout split: mapa de Google Maps full-bleed + barra de búsqueda sticky-top con dos inputs (origen / destino) usando Places Autocomplete sesgado a Colonia urbano, y un bottom sheet con la card del itinerario una vez que hay resultado.
- **Render del itinerario sobre el canvas.** Cada leg dibuja un Polyline (color por modo: walk gris punteado, bus en color de la línea), markers en stops del leg, y la card del bottom sheet lista las legs con tiempos + línea + tarifa.
- **Tarifa visible en la card.** Si `fare_attributes.txt` tiene precio confirmado, mostrar `UYU $X`; si no (plan B del [PRD §9](../../../docs/prd/mvp-v0.md#9-riesgos)), mostrar string explícito "Consultar al chofer" — el disclaimer del chrome ya cubre el "tarifas a confirmar" general.
- **Polyline encoding sobre el contrato existente de `/api/plan`.** El endpoint hoy devuelve legs sin geometría — sumar `legGeometry.points` (Google encoded polyline) a cada leg, decodeado en cliente con `google.maps.geometry.encoding.decodePath`.
- **Loader + sesgo de Places para Colonia.** El cliente carga Google Maps JS API (`maps`, `places`, `geometry`) vía un wrapper React tipado; el autocomplete viene con bounds restringido al bbox de Colonia urbano para no ofrecer Montevideo o Buenos Aires.
- **Estados de UI consistentes.** Loading mientras OTP rutea, empty inicial con copy guiado, error sanitizado (sin URLs internas) cuando `/api/plan` devuelve 502/400.
- **i18n key-by-key desde día 1.** Toda string user-facing en `messages/es.json` per [`viewer-shell-and-api` R-03](../../specs/viewer-shell-and-api/spec.md), siguiendo la convención del shell.

## Capabilities

### New Capabilities

- `viewer-od-mode`: pantalla principal del demo — Google Maps JS como canvas, Places Autocomplete con sesgo geográfico, llamado a `/api/plan`, render de itinerarios sobre el mapa, card de tarifa, estados loading/empty/error. Es el primer "viewer mode" de los tres (OD, stop-info, line-schedule) del [PRD §11](../../../docs/prd/mvp-v0.md#11-próximos-pasos).

### Modified Capabilities

- `viewer-shell-and-api`: extender el contrato de `POST /api/plan` (R-04) para incluir `legs[].legGeometry.points` (Google encoded polyline) — habilita el render de la ruta sobre el mapa sin necesidad de un segundo round-trip a OTP. La página `/` deja de ser placeholder y monta el mode OD como server component que hidrata en cliente.

## Impact

- **Código nuevo (`viewer/`):**
  - `app/page.tsx`: pasa de placeholder a montar `<OdModeShell />` (Server Component que pasa la API key como prop al client wrapper).
  - `components/od/`: `MapCanvas`, `SearchBar`, `OriginDestinationInputs`, `ItineraryCard`, `LegPolyline`, hooks (`usePlanQuery`, `useMapsLoader`).
  - `lib/google-maps/`: loader tipado, Places Autocomplete biased a Colonia, helpers de polyline color por mode.
  - `lib/otp/translate-plan.ts`: extender `RestLeg` con `legGeometry: { points: string } | null` y la query GraphQL con `legGeometry { points }`.
  - `messages/es.json`: claves nuevas `od.search.origin.placeholder`, `od.search.destination.placeholder`, `od.card.duration`, `od.card.fareUnconfirmed`, etc.
  - Tests vitest + RTL: `MapCanvas` con loader mockeado, traductor con polyline, hook de plan con axios mock, card de itinerario con fixture, estados loading/empty/error.
- **Dependencias:**
  - `@vis.gl/react-google-maps` (wrapper React tipado de Maps JS API, mantiene compat con SSR/Server Components).
  - Tipos `@types/google.maps`.
  - **Sin nueva dependencia runtime de Google Directions o Transit Partners** — solo del canvas (Maps JS) y Places Autocomplete, alineado con [PRD §5.3](../../../docs/prd/mvp-v0.md#53-local-first-en-el-motor-de-planning).
- **Env vars:**
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — bundleada al cliente (públicamente visible), restringida por HTTP referrer en GCP. Documentar en `.env.example` y `viewer/README.md`.
  - `NEXT_PUBLIC_VIEWER_DEFAULT_CENTER` opcional para override del centro del mapa (default: Colonia urbano).
- **Dependencias del PRD desbloqueadas:**
  - Tarifa Sol Antigua confirmada ([§7](../../../docs/prd/mvp-v0.md#7-dependencias-bloqueantes)) — si llega a tiempo el modo OD la muestra; si no, "Consultar al chofer" hasta el siguiente release.
  - Google Maps API key con restricción referrer ([§7](../../../docs/prd/mvp-v0.md#7-dependencias-bloqueantes)) — necesaria para que CI smoke pueda hacer un render headless validable.
- **CI:**
  - `viewer.yml` (lint + vitest + next build) cubre todo el código nuevo sin cambios al workflow.
  - `viewer-smoke.yml` — opcional: sumar un step que cargue `/` y verifique que el HTML contiene el script loader de Google Maps + ids de los inputs. Render real del mapa requiere browser headless (Playwright) — se deja como mejora futura, no v0.
- **Out of scope (próximos changes):**
  - Tap-on-stop con próximos buses + ETAs (`viewer-stop-info-mode`).
  - Vista por línea con trazado + paradas + vehículos live (`viewer-line-schedule-mode`).
  - Selector de hora/fecha futura ("salir a las 18:30 del jueves"). v0 usa "now" o "now + 5 min" por default.
  - Multi-itinerary swiper. v0 muestra el primer itinerary del array; el array completo queda en el response para iterar en v0.1+.
