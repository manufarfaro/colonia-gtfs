## Why

El [PRD §8.1 #5](../../../docs/prd/mvp-v0.md#81-funcionalidad) — "el usuario selecciona una línea (3, 4, 5, 8) desde alguna vista de navegación y ve el trazado completo + paradas + posición live de vehículos + horarios del día" — es el último de los tres criterios funcionales del demo. Hoy los endpoints existen (`viewer-shell-and-api` R-06 `/api/lines/:id` con shape + directions + scheduledDepartures, R-07 `/api/lines/:id/vehicles` con vehicles live filtrados), pero falta la UI que los componga: un selector de línea + el render del trazado completo + un overlay con markers de vehicles que se actualizan cada 15 s (mismo cadence que OTP poolea del bridge).

## What Changes

- **Selector de línea sobre el chrome del viewer.** Un componente compacto (probablemente un sticky bar debajo del Header o un FAB tipo Google Maps) con las 4 líneas v0 (3, 4, 5, 8) cliqueables. Cada chip muestra el `shortName` + el color de la paleta del modo OD (`getLineColor`). Tap → activa el modo line-schedule para esa línea.
- **Vista de línea sobre el mapa.** Activada por tap en el chip o por deep-link `#line=<shortName>`. Renderiza:
  - El trazado completo de los 2 patterns (ida + vuelta) usando los polylines del response (`viewer-shell-and-api` R-06 → `directions[].patternGeometry`).
  - Markers en cada stop de la línea, sin distinción por dirección (el viewer ya tiene el primitivo `StopMarker`).
  - Markers de vehicles live (color y label distintos a los markers de stops; flecha indicando bearing si el feed lo trae) — poll cada 15 s a `/api/lines/:id/vehicles`. Sin sheet abierto / modo distinto, no hay tráfico.
- **Bottom sheet con horarios del día.** Lista de horarios scheduled del día actual (`directions[].scheduledDepartures` ya está en el response, formato HH:MM), agrupada por dirección con headsigns ("Centro" / "Real de San Carlos"). Tap-on-stop dentro del sheet o sobre el mapa abre `viewer-stop-info-mode` apilado por encima (mismo patrón que el OD).
- **Mode-state compartido del `viewer-stop-info-mode`.** Reusa el `useViewerMode` hook + URL hash params que la otra propuesta introduce. Línea seleccionada vive como `#line=4`; cerrar el sheet vuelve al modo previo (OD por default).
- **i18n keys nuevas en `od.lineSchedule.*`.**

## Capabilities

### New Capabilities

- `viewer-line-schedule-mode`: nuevo viewer mode que se activa por tap en un line chip o por deep-link `#line=<shortName>`. Pinta el trazado completo + paradas + vehicles live (poll 15s) sobre el mapa + un bottom sheet con horarios del día agrupados por dirección.

### Modified Capabilities

- `viewer-od-mode`: extiende el `MapCanvas` para aceptar un layer paralelo a la itinerary (el trazado completo de una línea + sus markers + sus vehicles). El componente debe poder pintar **ambas cosas a la vez** si la app combina OD + line-schedule (decisión: no se combinan en v0 — modo activo es uno solo, los tres son mutuamente excluyentes). El selector de líneas vive en la search bar slot existente, junto a los inputs de origen/destino (depende del modo activo: en OD se muestran los inputs, en line-schedule la lista de líneas).
- `viewer-stop-info-mode`: depende de su apply previo (este change asume que el hook `useViewerMode` y el primitivo `BottomSheet` ya están en `main`). Compatibilidad bidireccional: tap-on-stop dentro de la vista de línea abre el sheet de stop-info; tap en un vehicle marker dentro de stop-info no hace nada en v0 (puede mostrar el last-known-position pero diferido a v0.1+).

## Impact

- **Código nuevo (`viewer/`):**
  - `components/line-schedule/LineSelector.tsx` + test: chips por línea v0 (3, 4, 5, 8); color de la paleta; tap → setMode({type:'line-schedule', shortName}).
  - `components/line-schedule/LineScheduleCard.tsx` + test: bottom sheet con header (shortName + longName), tabs por dirección (ida/vuelta), lista de horarios.
  - `components/line-schedule/useLineQuery.ts` + test: hook que carga `/api/lines/:id` (con cache TTL de R-06; no necesita poll) y mantiene la shape para el sheet + el render.
  - `components/line-schedule/useVehiclesQuery.ts` + test: hook que poolea `/api/lines/:id/vehicles` cada 15s con AbortController; reset al cambiar de línea o salir del modo.
  - `components/line-schedule/VehicleMarker.tsx` + test (mocked igual que `StopMarker`): pinta el marker de un vehicle live con color de línea + arrow opcional para bearing.
  - `components/line-schedule/LineRouteLayer.tsx` + test: renderea los polylines + stops de la línea como una capa apilable sobre el mapa.
- **Código modificado:**
  - `components/od/MapCanvas.tsx`: prop nueva `lineLayer?: { directions, stops, vehicles }` que pinta la capa de la línea. Tap-on-stop sigue funcionando vía el mismo handler de la propuesta `viewer-stop-info-mode`.
  - `components/od/OdModeShell.tsx`: cuando el `useViewerMode` devuelve `{type:'line-schedule', shortName}`, renderiza `<LineSelector>` en la search slot (en lugar de los inputs O→D) y `<LineScheduleCard>` en el sheet.
  - `messages/es.json`: namespace `od.lineSchedule.*` con `selector.label`, `selector.lineLabel`, `card.directionLabel`, `card.scheduledDeparturesLabel`, `state.loading`, `state.errorOtp`, `vehicles.label`.
- **Sin cambios a la API** — `/api/lines/:id` y `/api/lines/:id/vehicles` ya tienen las shapes correctas. El handler de vehicles ya tiene contrato R-07 de "200 con `vehicles: []` cuando el bridge falla" — perfecto para que el UI degrade graceful.
- **Tests + coverage:** mantiene el 100% threshold. Polling 15s testeado con `vi.useFakeTimers({toFake: ['setInterval','setTimeout']})`. El `VehicleMarker` se mockea igual que `StopMarker` (excluido del coverage por ser runtime-only Google Maps).
- **Dependencia explícita de orden**: este change asume que `viewer-stop-info-mode` aplicó primero (introduce `useViewerMode` + `BottomSheet`). El propose puede correr ahora en paralelo; el apply tiene que ser secuencial.
- **Out of scope (próximos changes / no v0):**
  - Click en vehicle marker → modal con last-known + occupancy: occupancy es D11 del PRD (no v0), modal queda diferido.
  - Selector de día/hora futura para los scheduled departures: v0 muestra solo "hoy".
  - Predicción de ETA en cada stop de la línea: requiere otro endpoint OTP; v0 deja el detalle a `viewer-stop-info-mode`.
