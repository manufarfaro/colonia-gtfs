## ADDED Requirements

### Requirement: The viewer SHALL expose a client-side mode state via URL hash routing

The viewer SHALL introduce a single mode-state hook (`useViewerMode` or equivalent) that reads and writes a URL hash to represent the currently active viewer mode. The hook SHALL recognise three mode markers in v0:
- empty / no hash → OD mode (the default)
- `#stop=<gtfsId>` → stop-info mode (see [`viewer-stop-info-mode`](../viewer-stop-info-mode/spec.md))
- `#line=<shortName>` → line-schedule mode (reserved for the next capability)

The hook SHALL listen for `popstate` events so that the browser's back/forward buttons navigate between mode entries transparently. The hook SHALL provide a `setMode(next)` function that performs `history.pushState` and dispatches a synthetic `hashchange` so React updates re-render the shell.

#### Scenario: Default mode is OD when no hash is present
- **WHEN** the page loads at `https://demo/`
- **THEN** the hook returns `{type: 'od', ...}` and the shell renders the OD inputs in the search slot

#### Scenario: Hash on initial load drives the initial mode
- **WHEN** the page loads at `https://demo/#stop=sol-antigua:3`
- **THEN** the hook returns `{type: 'stop-info', stopId: 'sol-antigua:3'}` from the very first render — before any user interaction

#### Scenario: Browser back navigates between modes
- **WHEN** the user picks an OD itinerary, then taps a stop marker (mode becomes stop-info), then hits the browser back button
- **THEN** the viewer returns to the OD mode and the stop-info sheet closes

### Requirement: The bottom sheet SHALL be extracted as a reusable primitive

The bottom-sheet markup currently inlined inside `OdModeShell.tsx` SHALL move to a standalone primitive component (`components/od/sheet/BottomSheet.tsx` or equivalent). The primitive SHALL expose:
- `open: boolean` — whether the sheet is currently shown.
- `onClose: () => void` — invoked when the user dismisses the sheet (close button, swipe, ESC).
- `children: React.ReactNode` — the content rendered inside the sheet.
- An accessible `role="dialog"` + `aria-modal="true"` when open.

The primitive SHALL be used by every mode that renders a bottom sheet (stop-info, line-schedule, and OD's itinerary card). Inline duplication of the sheet markup SHALL NOT remain in any mode component.

#### Scenario: The OD itinerary card renders inside the shared primitive
- **WHEN** the OD mode is active with a successful plan response
- **THEN** the bottom of the viewport renders the `<BottomSheet open>...<ItineraryCard ... /></BottomSheet>` composition, not an inline sheet div

#### Scenario: Swipe-down dismisses the sheet via the primitive
- **WHEN** the sheet is open and a touchstart at y=N is followed by a touchend at y=N+THRESHOLD
- **THEN** the primitive invokes its `onClose` callback (the host mode then decides what to do with the dismissal — typically `setMode` back to a previous state)

## MODIFIED Requirements

### Requirement: The viewer SHALL replace the root page (`/`) with an OD planning mode

The viewer's root route (`app/page.tsx`) SHALL render the OD planning experience as the default landing — replacing the v0 placeholder shipped with [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-02 — but its concrete content is now selected via the `useViewerMode` hook introduced in this delta. The chrome persistente (header + disclaimer banner) SHALL remain wrapped around the mode via the existing `app/layout.tsx`. The page SHALL render:

- The **OD search inputs** in the sticky-top search slot **when** the active mode is `od`.
- The **stop-info bottom sheet** when the active mode is `stop-info` (per [`viewer-stop-info-mode`](../viewer-stop-info-mode/spec.md)).
- The line-schedule selector and sheet when the active mode is `line-schedule` (reserved).

No additional Next.js route SHALL be added in v0; mode switching is purely client state plus URL hash, server-rendered by `app/page.tsx` reading no per-mode props.

#### Scenario: Root renders the OD mode by default
- **WHEN** a client requests `GET /` against a freshly booted viewer with no URL hash
- **THEN** the HTML response carries the chrome persistente + the OD search inputs in the search slot + the OD idle hint copy in the bottom sheet

#### Scenario: Deep-link to a non-OD mode still renders the chrome
- **WHEN** the client opens `GET /#stop=sol-antigua:3`
- **THEN** the chrome persistente still appears in the HTML, and the client-side hydration mounts the stop-info mode in place of the OD UI

### Requirement: The OD result SHALL render the first itinerary on the map as polylines + markers

The OD result rendering remains as defined by [`viewer-od-mode`](../../specs/viewer-od-mode/spec.md) R-04, with one additional behaviour: each `StopMarker` rendered on the map SHALL be clickable. When tapped, the marker SHALL dispatch the click to a parent-provided handler (`onStopClick(stopId: string)`). The OD shell, when wiring `<MapCanvas>`, SHALL connect this handler to the `setMode({type: 'stop-info', stopId})` of the mode hook.

#### Scenario: Tap on an itinerary stop marker dispatches the mode change
- **WHEN** the user taps a marker for a leg's boarding/alighting stop
- **THEN** the URL hash updates to `#stop=<id>` and the stop-info mode activates while the itinerary remains visible on the map
