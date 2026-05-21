## Context

Backend listo (`viewer-shell-and-api` R-06 + R-07), modos OD y stop-info en `main`. Falta la vista por línea — el modo más data-rico de los tres porque combina:
- el trazado completo de los 2 patterns (ida + vuelta) que viene de `/api/lines/:id`,
- las 130 stops de la línea (un orden de magnitud más markers que un itinerary del OD),
- vehicles live polleados cada 15 s desde `/api/lines/:id/vehicles`,
- horarios scheduled del día en un sheet con tabs por dirección.

Este change **depende de `viewer-stop-info-mode`** (introduce el hook `useViewerMode` + el primitivo `BottomSheet` que line-schedule reusa). Apply va a ser secuencial. Propose puede correr ahora en paralelo porque las decisiones de design son aditivas.

**Stakeholders:**
- Turista: caso "voy a usar la línea 4 este finde, ¿cómo es?" — recorrido completo + horarios.
- Operador: la vista por línea es la que más expone el detalle del feed; valida el modelado (`viewer-shell-and-api` R-06 ya cubre `directions[].stops/scheduledDepartures/patternGeometry`).

**Restricciones:**
- **Modos mutuamente excluyentes**: line-schedule activa reemplaza al OD/stop-info; cerrar vuelve al modo previo. No mostramos selector-de-línea + inputs O→D al mismo tiempo.
- **15 s para vehicles**: alineado con el OTP pull-rate del bridge (per `otp-routing` R-05). Más frecuente desperdicia; menos hace que el marker se mueva en saltos visibles.
- **130 markers + 2 polylines en el render**: hay que verificar que Maps JS no se queja a esa escala. v0 lo banca; v0.1+ podría requerir clustering.

## Goals / Non-Goals

**Goals:**
- Selector visible con las 4 líneas v0 (3, 4, 5, 8); cada chip con color de la paleta.
- Tap chip → modo line-schedule activado → URL hash `#line=<short>`.
- Mapa pinta trazado completo (ambos patterns) + todos los stops + vehicles live.
- Bottom sheet con tabs Centro / Vuelta (o las direcciones que el feed declare), horarios HH:MM scheduled del día.
- Vehicles refrescan cada 15 s mientras el modo está activo.
- Tap-on-stop dentro de la vista → apila el modo stop-info encima (cerrar vuelve a line-schedule, no a OD).
- Deep-link `#line=4` carga la app directo en la línea 4.

**Non-Goals:**
- Click en vehicle marker → detalle / occupancy / last-known: occupancy es D11 firme del PRD (no v0).
- Selector de día futuro para los scheduled: v0 muestra solo "hoy".
- ETA por stop dentro del bottom sheet de la línea: ese detalle vive en stop-info (separación de modos).
- Clustering de stops a alto zoom-out: 130 markers para una sola línea cabe; combinarlo a través de las 4 líneas sería el problema (no en v0).
- Multi-línea overlay (mostrar las 4 a la vez): mantiene la simplicidad del demo.

## Decisions

### D-01 — Reusa `useViewerMode` + `BottomSheet` del stop-info change

**Decisión:** Este change asume que el apply de `viewer-stop-info-mode` ya está en `main`. Importa directamente:
- `useViewerMode()` para leer/escribir el hash.
- `BottomSheet` primitivo del path `components/od/sheet/BottomSheet.tsx`.

**Por qué:**
- Cero duplicación. El stop-info ya pagó el costo de extraerlos.
- Cualquier mejora futura al sheet primitivo se propaga.

**Cómo aplica:**
- El order del apply queda explícito (stop-info → line-schedule).
- Si por alguna razón se mergea line-schedule primero, este change tendría que incluir la extracción del sheet + el hook — y refactorearía OdModeShell de forma duplicada. Evitable manteniendo el orden.

### D-02 — LineSelector vive en la search slot del shell (no en el sheet)

**Decisión:** El selector de líneas (4 chips) reemplaza a los inputs O→D en la `sticky-top search slot` del shell **cuando el modo activo es line-schedule** (o como FAB cuando el modo es OD — TBD UX).

v0 keep-it-simple: cuando el modo es OD, los inputs O→D viven en la slot. Cuando el modo es line-schedule, los chips. Cuando el modo es stop-info, ninguno (el sheet ocupa la atención).

Para entrar al modo line-schedule desde OD: tap a un botón "Líneas" en el search bar (icon-only, junto al theme toggle del Header).

**Por qué:**
- Mobile-first: una sola fila sticky-top, no apilamos selectores.
- Mimicea Google Maps Transit: ahí también el selector de mode aparece según el contexto.

**Alternativas consideradas:**
- FAB persistente con icono de líneas en bottom-right: más Material-design pero choca con el bottom sheet.
- Tabs en el chrome (OD / Líneas / Paradas): añade ruido cuando el usuario no las necesita.

### D-03 — Tap-on-stop dentro del modo line-schedule apila stop-info

**Decisión:** El hook `useViewerMode` mantiene una pila de modos previos. `setMode({type:'stop-info', stopId}, {push: true})` apila; cerrar el stop-info hace `popMode()` y vuelve al `line-schedule`.

Implementación: el modo actual + un previousMode opcional en el state del hook. Cerrar el sheet de stop-info → `setMode(previousMode ?? {type:'od'})`.

**Por qué:**
- Mantiene la continuidad: el user veía la vista de la línea, hace tap en una parada, vuelve a la vista de la línea (no a OD).
- Stack profundo (más de 1 nivel) no aporta: si va de stop a otro stop, ese reemplaza, no apila más.

### D-04 — Map markers: re-rendering al escalar

**Decisión:** `LineRouteLayer.tsx` recibe `{directions, vehicles}` y renderea:
- Para cada `direction`: un `LegPolyline`-style `<Polyline>` con `direction.patternGeometry.points` + color de la línea + `strokeWeight: 5`.
- Para cada `direction.stops[i]`: un `<StopMarker>`.
- Para cada `vehicle`: un `<VehicleMarker>` (igual que StopMarker pero con icon distinto + color de línea + label opcional con bearing).

Cuando los vehicles refrescan (cada 15s), solo los `<VehicleMarker>` se rerendean. React + `key={vehicle.id}` mantiene el resto estable.

**Por qué:**
- Reusa el primitivo de polyline existente.
- Update granular: 130 markers de stops no se re-mount, solo los vehicles (típicamente < 5 por línea).

**Trade-off:**
- Si Maps JS muestra lag con > 100 markers, considerar clustering. v0 va sin clusterizar — la línea con más stops es la 4 (~35 paradas), perfectamente jugable.

### D-05 — Poll cadence + AbortController

**Decisión:** `useVehiclesQuery(shortName)` poolea cada **15 s** (no 30 — los vehicles se mueven y el desfase visual de 30 s es notable). `useLineQuery(shortName)` se fetcha una vez por modo entrada (cache TTL del backend ya está; el cliente no necesita re-fetcher).

AbortController per iteración + per cambio de línea. Reset al desmontar el componente.

### D-06 — Tabs de dirección en el sheet

**Decisión:** `LineScheduleCard` rinde tabs basadas en las `directions` del response. Cada direction tiene `directionId: 0 | 1` y `headsign` (ej. "Centro", "Real de San Carlos"). Tab activa default = directionId 0.

Si una línea solo tiene un pattern (raro pero posible para líneas no-circulares), el tab list es solo uno (no se renderiza la barra de tabs).

**Por qué:**
- Estructura GTFS native — directionId es estándar.
- Headsign en español ya viene del feed (no se i18n).

### D-07 — VehicleMarker: bearing y color

**Decisión:** El marker visual usa el color de la línea (`getLineColor(shortName)`). Si el vehicle trae `bearing !== null`, renderiza un arrow icon orientado; si no, un dot.

Implementación: `google.maps.Marker` con `icon: { path, fillColor, rotation }`. Runtime-only — excluido del coverage como `StopMarker`/`LegPolyline`.

### D-08 — Layout cuando el sheet está abierto

**Decisión:** El sheet ocupa la mitad inferior del viewport por default; el mapa queda visible arriba. El selector de línea (search slot) sigue sticky-top. Si el user hace swipe-up sobre el sheet, expande a 75% de la altura (igual que en stop-info).

### D-09 — Coverage strategy

**Decisión:** Mantiene el 100% threshold. Componentes runtime-only excluidos:
- `VehicleMarker.tsx` (instancia `google.maps.Marker` directo).
- `LineRouteLayer.tsx` (orquesta primitivos no-testables) — excluido.

Lo testeable:
- `useLineQuery` / `useVehiclesQuery`: mock fetch, validar polling cadence con `vi.useFakeTimers({toFake:['setInterval','setTimeout']})`.
- `LineSelector`: assert chips rendered + onClick dispatcha el setMode correcto.
- `LineScheduleCard`: assert tabs, scheduled departures rendered, click en stop → setMode stop-info push.
- Mode switching: el hook + el shell con cambios de modo (assert que cambiar `#line=4` → `#line=5` no remount-ea todo).

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Tu apply choca con un `useViewerMode` ya extendido (race vs stop-info)** | Apply secuencial documentado (D-01). Si por una emergencia se mergean en paralelo, line-schedule rebase post-stop-info con merge del switch del hook. |
| **130 markers + 2 polylines de la línea 4 lagguean Maps JS** | Empíricamente — Maps JS banca 1000+ markers sin sweat. La línea 4 a ~35 stops no es problema. Si lo fuera, swap a `MarkerClusterer` (lib de Google). |
| **Vehicles render desfasado vs su lat/lon real porque el bridge sirvió el `.pb` justo después del último pull** | 15s poll = max staleness 15s vs un bus que avanza ~80m a 20km/h. Aceptable para v0 demo. Visualmente fluido si el bus se mueve en línea recta sin "saltos". |
| **El selector de línea se vuelve hostil para v0.1 cuando sumemos ABC Coop con 8+ líneas** | v0 hardcodea las 4 líneas Sol Antigua. El componente recibe la lista por prop — futuro: dinamizar via `/api/lines` (no existe; sumar como mini-spec). |
| **Tap-on-vehicle accidental cuando el user quiere zoom-out cerca del bus** | Stop markers + vehicle markers compiten por el touch target. Vehicle marker un poco más chico, posiblemente con `clickable: false` para evitar el conflicto (modo OD-like donde solo los stops son tappable). |

## Migration Plan

- Asume que `viewer-stop-info-mode` ya está aplicado en `main`. Si no, este apply se bloquea con un error claro.
- `MapCanvas` gana props opcionales (`lineLayer?: {...}`); el modo OD existente sigue pintando `itinerary` igual que antes. Backward-compatible.
- `OdModeShell` extiende el switch del modo. Las copias previas del shell siguen funcionando — si una vista existente accidentalmente pasa `mode='line-schedule'` sin contexto, render igual que `mode='od'` (degradación segura — pero el `useViewerMode` controla el dispatch, no debería suceder).

## Open Questions

- **Q1 — Entry point al modo line-schedule.** Botón "Líneas" en el Header? FAB? Ahora pintado en D-02 como botón en el chrome derecho del search slot (junto al theme toggle). Validar en el demo.
- **Q2 — Vehicle marker bearing rotation supports.** Google Maps JS soporta `icon.rotation` pero requiere `SymbolPath` (no PNG). v0 con dot + tint del color de la línea + tooltip opcional con `bearing°`; arrow oriented diferido si el demo lo pide.
- **Q3 — Should vehicle markers persist when the modo line-schedule cambia de línea?** No — `useVehiclesQuery` reset al cambiar `shortName`. Vehicles de la línea anterior desaparecen instantáneamente. Snappy.
- **Q4 — Multi-language headsigns.** Stop names y headsigns en español always (per PRD §3.4). Cuando se sumen EN/PT, se mantienen los headsigns en español. No es problema en v0.
