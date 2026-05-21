## Context

El stack tiene los servicios + la chrome + el modo OD funcionando (PRs #21, #22, #23). El backend de stop-info ya está construido — `viewer-shell-and-api` R-05 expone `/api/stops/:stopId/arrivals` con `arrivals[].isRealtime + delaySeconds + scheduled/realtime times` ya merged. Lo que falta es el UI: tap-on-stop → bottom sheet con las llegadas.

Este change introduce además una **infra compartida** para que los tres viewer modes (OD, stop-info, line-schedule) coexistan sobre el root `/` sin pisarse — porque el siguiente change (line-schedule) va a reusar exactamente la misma plomería.

**Stakeholders:**
- Turista (audiencia PRD §2.1): tap en una parada → ETAs en pantalla en < 1s.
- Operador: el detalle por parada es una de las consultas más frecuentes en transit apps; cumplirlo bien valida que el modelo realtime del bridge llega al cliente.
- Tech lead: la decisión de mode-state aquí define el patrón para los próximos 2 modes — vale invertir 20 minutos extra en pensarla bien.

**Restricciones:**
- **Three modes mutuamente excluyentes en v0**: el viewer rinde OD o stop-info o line-schedule por vez. No mostramos los tres a la vez (PRD §5.1 mimicea Google Maps Transit; ahí los modes no se solapan).
- **Deep-links shareables**: para el demo, queremos poder copiar la URL y pegarla a alguien. Eso fuerza state-in-URL.
- **Mobile-first**: el sheet tiene que ser dragable + cerrable con swipe + back button.
- **Mantener el 100% coverage threshold** del `viewer-shell-and-api`.

## Goals / Non-Goals

**Goals:**
- Tap-on-stop marker (sea de un itinerary del modo OD o del trazado de line-schedule cuando exista) abre el stop-info sheet.
- Deep-link `https://demo/#stop=sol-antigua:3` carga la app directo en el modo stop-info de esa parada.
- Las arrivals refrescan cada 30s mientras el sheet está abierto.
- Realtime vs scheduled visualmente diferenciados (badge "En vivo" en las realtime; otra señal sutil para las scheduled).
- Cerrar el sheet (back button, swipe, X) vuelve al modo previo.
- `OdModeShell` queda factorizado de modo que sumar el line-schedule en el próximo change sea aditivo, no refactor.

**Non-Goals (explícitos):**
- Tap-on-map genérico (no en un marker): v0.1+.
- Click en vehicle marker: out of scope.
- Push realtime via SSE/WebSocket: poll 30s alcanza para el demo.
- Predicción / "tiempo real" agresivo (sin OTP-RT siempre, default to scheduled cuando falta): el modelo de fallback ya está en el response R-05.
- Bookmarks / favoritos del usuario.
- Tests integration full-stack del sheet: la SDK de Maps no se renderea sin browser real; tests unitarios + smoke E2E del endpoint cubren el contrato.

## Decisions

### D-01 — Mode-state vía URL hash (no path)

**Decisión:** Los modos viven en URL hash (`/#stop=<gtfsId>`, `/#line=<shortName>`, `/` ó `/#` = modo OD). El custom hook `useViewerMode()` lee/escribe el hash y expone `{type: 'od' | 'stop-info' | 'line-schedule', payload}`. Cambio de modo → `history.pushState({}, '', '#stop=...')` + dispatcheo de `hashchange` (next.js App Router no toca los hashes ni rerendera al cambiarlos — son client-only).

**Por qué:**
- **Deep-links shareables**: el caso real ("acá fijate cuándo pasa el bus en esta parada" + URL pegada a WhatsApp) los necesita.
- **No requiere routes adicionales**: una sola page `/` server-component, todo el switching es client-side via el hook.
- **Back button funciona free**: `popstate` listener en el hook → el browser back/forward navega entre modos sin recarga.
- **Es el patrón Google Maps**: ellos hashean el viewstate (lat,lng,zoom) sobre el mismo path; la analogía es directa.

**Alternativas consideradas:**
- Path routes (`/`, `/stops/:id`, `/lines/:id`): más Next-idiomático pero pierde el "stay on map" feel + obliga a remontar el map en cada navigation. Costoso para mobile.
- Sólo client state (sin URL): pierde el deep-link shareable, mata el use-case principal del demo.
- Query params (`/?mode=stop&id=…`): los routers de Next pueden capturarlos server-side; menos clean que hash para algo 100% client.

**Cómo aplica:**
- `components/mode/useViewerMode.ts` exporta el hook + `setMode(next)` para mutar.
- `OdModeShell` toma el `mode` y decide qué pintar en la search slot + el sheet.
- Inicial load: el hook hace parse del hash al primer render.

### D-02 — Extraer el bottom sheet a primitivo compartido

**Decisión:** El bottom sheet inlined en `OdModeShell` se extrae a `components/od/sheet/BottomSheet.tsx`. Props: `{ open, onClose, children, ariaLabel? }`. Funcionalidad:
- Posicionado fixed bottom, z-index sobre el map.
- Animación slide-up/down al cambiar `open` (CSS transitions sobre transform-Y).
- Swipe-down to close (touch handlers).
- ESC + click-outside también cierran.
- Accessible: role="dialog" cuando está open + focus trap básico.

**Por qué:**
- Los tres modos lo usan con contenido distinto pero el chrome (border, shadow, animation, dismissal) es idéntico.
- Si lo dejamos inlined, el line-schedule duplicaría el código + bugs.
- Es un primitivo pequeño (~80 líneas), no justifica una lib externa.

**Cómo aplica:**
- Mueve la lógica de bottom-sheet desde `OdModeShell` a `BottomSheet`.
- `OdModeShell` y `StopInfoCard` (y luego `LineScheduleCard`) renderean `<BottomSheet open={...}>...</BottomSheet>`.

**Trade-off aceptado:**
- Swipe-to-close perfecto requiere RTL touch-events que son aburridos. v0 implementa una versión simple (touch start/move/end con threshold); refinamiento UX queda para post-v0.

### D-03 — Polling 30 s con AbortController + auto-cleanup

**Decisión:** `useArrivalsQuery(stopId)` poolea cada 30s mientras el hook está montado y `stopId !== null`. Implementación:
- `useEffect` arranca un `setInterval(fetch, 30_000)` + un fetch inicial.
- `AbortController` por iteración para cancelar in-flight al cambiar de stop o desmontar.
- Cleanup función del `useEffect` clear-ea el interval + aborta lo pendiente.

**Por qué:**
- 30s = mismo cadence del AVL upstream (per `bridge-gtfs-rt` R-06). Más frecuente no traería data nueva; menos frecuente desfasa el "en N min" del UI.
- AbortController prevent fugas de memory + double-set-state warnings.
- Sin sheet abierto → sin tráfico → no carga gratuita al backend.

### D-04 — Realtime vs scheduled: badge + tono

**Decisión:** En cada row de arrival:
- Si `isRealtime === true`: pequeño badge verde **"En vivo"** + el ETA en color full opacity (`text-foreground`).
- Si `isRealtime === false`: sin badge + el ETA en `text-muted-foreground` + un sufijo "(horario)" en small caps.

No usamos colores rojo/verde para distinguir — semánticamente el scheduled no es "error", es solo "menos preciso". El cambio sutil de jerarquía visual cumple PRD §8.1 #4 ("claramente diferenciado").

### D-05 — ETA formatting: relativa hasta 30 min, después absoluta

**Decisión:** `lib/format/eta.ts` exporta `formatEta(scheduledArrivalIso, nowIso, isRealtime)`:
- Calcula `(arrival - now)` en segundos.
- Si `≤ 0`: "Ahora" (o "Pasó hace X min" si delta absoluto > 60s).
- Si `< 1800s` (30 min): "en N min" (Spanish).
- Si `≥ 1800s`: "HH:MM" en TZ Montevideo.

**Por qué:**
- La intuición humana sobre "esperar el bus" funciona en minutos hasta los 30 min; más allá la hora absoluta es más útil ("a las 14:30" vs "en 47 min").
- Mantener una sola helper testeable centraliza el comportamiento + i18n.

### D-06 — Stop click handler en MapCanvas

**Decisión:** `MapCanvas` gana una prop opcional `onStopClick?: (stopId: string) => void`. Cuando está provided, los `StopMarker`s wrappers reciben un onClick que dispatcha `onStopClick(stopId)`. `OdModeShell` cablea esto a `setMode({type:'stop-info', stopId})`.

El click handler del marker imperativo vive dentro de `LegPolyline.tsx`'s `StopMarker` — runtime-only, excluido de coverage (igual que la propia construcción del marker). Lo testeable es el cableado en `MapCanvas` (que el handler se pasa down) + en `OdModeShell` (que el dispatch al hook ocurre).

### D-07 — Deep-link initial load

**Decisión:** En `useViewerMode`, el primer render parsea `window.location.hash`:
- `#stop=<id>` → modo stop-info, payload = id.
- `#line=<short>` → modo line-schedule, payload = short.
- Otherwise → modo OD.

Si el deep-link refiere a un stop inválido (404 del endpoint), el sheet renderiza un estado `errorNotFound` con copy localizada y un botón "Volver al inicio" que setea el modo a OD.

**Por qué:**
- Misma URL hash format que post-init. El hook tiene una única fuente de verdad.
- 404 graceful evita que un deep-link viejo a un stopId desaparecido rompa el demo.

### D-08 — i18n namespace

**Decisión:** Las keys del stop-info viven bajo `od.stopInfo.*` (no en un namespace nuevo `stopInfo.*`). El `od` namespace queda como home del modo viewer principal y los modos derivados anidan ahí. Esto mantiene la indentación del `messages/es.json` legible.

### D-09 — Coverage del mode hook + sheet primitivo

**Decisión:** `useViewerMode` y `BottomSheet` se testean unitariamente con `@testing-library/react` + `vi.stubGlobal('history', ...)` para el hook, fireEvent touch+keyboard para el sheet. Cualquier rama que requiera `document.body` u operaciones del DOM real queda dentro de los componentes "thin" del `components/ui` style — excluida del threshold.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **El hash routing rompe interactions con next-intl o next/navigation** | next-intl no usa el hash; next/navigation tampoco lee `window.location.hash`. Los hooks de Next se mantienen agnósticos. Test asserta que cambiar `mode` no triggea `usePathname` rerenders. |
| **Polling 30 s mantiene sockets vivos contra el viewer en el browser** | `fetch` con AbortController + el browser cierra el socket por sí mismo. Memory leak no es real — el `useEffect` cleanup limpia interval + abort. |
| **Touch swipe-to-close es flaky en mobile real** | v0 implementa el patrón mínimo (touch threshold). Si UX cae mal en el demo, se reemplaza con un único botón X bien grande. Tests con fireEvent.touchEnd cubren el path. |
| **Stop-info se abre en cuanto el deep-link arranca pero las arrivals tardan; usuario ve sheet vacío** | Sheet abre en estado `loading` con skeleton; copia "Cargando próximas llegadas..." (i18n key). |
| **`OdModeShell` se vuelve un god component al hostear los tres modos** | El shell delega contenido al sheet por modo via el `useViewerMode` switch; la lógica de cada modo vive en sus componentes propios. El shell solo orquesta. |
| **Hash cambia + el navegador hace scroll por el `#`** | Hash strings nuevos no matchean ids del DOM existentes. Si fuera un problema, `event.preventDefault()` + scrollTop manual en el listener. |

## Migration Plan

No hay breaking changes para usuarios:
- Sin hash en la URL → carga el modo OD igual que hoy. Pure backward-compatible.
- Las API stays the same. El stop-info consume `/api/stops/:id/arrivals` que ya cumple su contrato.

Para el next change (`viewer-line-schedule-mode`):
- Asume que este change ya está en `main`. `useViewerMode` y `BottomSheet` ya están.
- Suma `case 'line-schedule':` al switch del shell.
- Reusa el primitivo del sheet para el card de horarios.

## Open Questions

- **Q1 — Should the stop-info sheet stack on top of an OD result?** Cuando un itinerary del OD está dibujado y el user tap-ea uno de sus stop markers, ¿el sheet del stop-info reemplaza el card del OD o se monta encima? v0: reemplaza (cerrar el stop sheet vuelve al card del OD). Razón: mobile-first, no apilamos sheets.
- **Q2 — How does back button interact?** v0: cada modo cambia via `pushState` → el back nativo del browser navega entre modos. Si el browser histórico se vuelve molesto en el demo (back lleva al modo anterior en lugar de a la página anterior), considerar `replaceState` en algunos casos. Diferido.
- **Q3 — Stop name placement when the stop is part of an itinerary leg.** Los markers que `MapCanvas` renderiza hoy solo tienen `stopId`. Para el header del stop-info necesitamos el `stop.name` — viene en el response del endpoint `/api/stops/:id/arrivals` (R-05 ya lo expone). Resuelto.
