## Why

El [PRD §8.1 #4](../../../docs/prd/mvp-v0.md#81-funcionalidad) — "el usuario hace tap en una parada del mapa y ve los próximos buses con ETAs; cuando hay un bus tracked en vivo, el ETA usa GTFS-RT; si no, usa horario programado claramente diferenciado" — es uno de los tres criterios funcionales del demo (junto con OD y line-schedule). Hoy el modo OD ya rinde el mapa + render del itinerary; falta el handler `onClick` sobre las paradas (markers + stops del polyline) que abra un panel con las próximas llegadas. El backend está listo: `viewer-shell-and-api` R-05 ya expone `/api/stops/:stopId/arrivals` con la mezcla scheduled+realtime. Este change cierra el loop UI.

## What Changes

- **Tap-on-stop sobre el mapa.** Cualquier marker de parada (sea de un itinerary del modo OD o del modo line-schedule) que el usuario toque abre un **bottom sheet** dedicado con las próximas llegadas. La interacción mimicea Google Maps Transit: el sheet se monta sobre el sheet actual sin perder contexto del mapa.
- **Card con próximos buses + ETAs.** Lista las 10 próximas (default; clamp 1–50) llegadas en orden cronológico, una row por llegada: línea (`shortName`) · headsign · ETA absoluta (`HH:MM`) o relativa ("en 4 min") · badge **"En vivo"** si la entrada es realtime, sutilmente diferenciada si es scheduled. Stop name + última hora de query en el header del sheet.
- **Mode-state compartido en URL hash.** Para que los tres modos del viewer (OD, stop-info, line-schedule) coexistan limpio sobre el root `/`, se introduce un hook `useViewerMode` que lee/escribe URL hash params (`#stop=<gtfsId>`, `#line=<shortName>`). Tap en una parada navega a `#stop=…`; cerrar el sheet vuelve al modo activo previo. Habilita deep-links para compartir vistas (ej. "mostrale a alguien las próximas llegadas en INT SUAREZ").
- **Bottom sheet extraído como primitivo compartido.** El sheet inlined que vive hoy en `OdModeShell` se mueve a `components/od/sheet/BottomSheet.tsx` (renaming del path porque el sheet se vuelve transversal a modos). Ahora cada modo monta su propio contenido dentro del primitivo.
- **Pull cada 30s mientras el sheet está abierto.** Las ETAs se refrescan con el mismo cadence del bridge (30s = poll-interval del AVL upstream). Sin sheet abierto, no hay tráfico contra `/api/stops/:id/arrivals`.
- **i18n keys nuevas en `od.stopInfo.*`** (el namespace `od` se mantiene como home del modo viewer principal; los modes derivados anidan ahí).

## Capabilities

### New Capabilities

- `viewer-stop-info-mode`: nuevo viewer mode que se activa por tap-on-stop sobre el mapa o por deep-link `#stop=<gtfsId>`. Pinta un bottom sheet con stop name + próximas N llegadas (mezcla scheduled+realtime), refresca cada 30s, cierra con back/swipe.

### Modified Capabilities

- `viewer-od-mode`: extrae el bottom sheet inlined a `components/od/sheet/BottomSheet.tsx` (componente primitivo, no atado al modo OD). Suma `useViewerMode` hook + URL hash routing como base para los modos derivados. El estado de cada modo (OD endpoints, stop seleccionado, line seleccionada) ahora se compone via el mode state — el modo OD pasa a ser uno de tres en paralelo. Los markers que pinta MapCanvas ganan un click handler que dispatcha `setMode({type: 'stop-info', stopId})`.

## Impact

- **Código nuevo (`viewer/`):**
  - `components/mode/useViewerMode.ts` + test: hook que lee/escribe URL hash (`#stop=…`, `#line=…`); fallback a OD mode (`#` o sin hash). Listener de `popstate` para sync con back button.
  - `components/od/sheet/BottomSheet.tsx` + test: primitivo extraído del inlined del shell. Recibe `children`, `open`, `onClose`. Soporta el role/aria + el dragable to expand del PRD.
  - `components/stop-info/StopInfoCard.tsx` + test: stop name header + arrivals list con row por arrival (línea + headsign + ETA + badge realtime).
  - `components/stop-info/useArrivalsQuery.ts` + test: hook con polling 30s + AbortController; AbortController cancela cuando el stop cambia o el sheet cierra.
  - `lib/format/eta.ts` + test: formatea seconds-from-now a "HH:MM" o "en N min" según proximidad.
- **Código modificado:**
  - `components/od/OdModeShell.tsx`: usa `useViewerMode` para decidir qué sheet pintar (`od` | `stop-info` | `line-schedule`). El sheet inlined se mueve.
  - `components/od/MapCanvas.tsx`: agrega prop `onStopClick(stopId)` que `OdModeShell` cablea a `setMode({type:'stop-info', stopId})`. `StopMarker` gana onClick handler.
  - `messages/es.json`: nuevo namespace `od.stopInfo.*` con `header.title`, `header.queriedAt`, `arrival.eta.relative`, `arrival.eta.absolute`, `arrival.badge.live`, `arrival.badge.scheduled`, `state.loading`, `state.errorEmpty`, `state.errorOtp`, `state.errorNotFound`.
- **Sin cambios a la API** — `/api/stops/:id/arrivals` ya tiene la shape correcta. Solo se documenta el campo `isRealtime` en el README.
- **Tests + coverage:** mantiene el 100% threshold. Polling 30s testeado con `vi.useFakeTimers({toFake: ['setInterval','setTimeout']})` controlando los ticks.
- **Out of scope (próximos changes / no v0):**
  - Tap-on-map (sobre cualquier punto, no solo markers): por ahora solo los stop markers son tappable. Tap genérico → modo OD para elegir destino, diferido a v0.1+.
  - Realtime push (SSE/WebSocket): poll 30s es suficiente para v0 demo cerrado; pull-architecture mantiene el costo bajo.
