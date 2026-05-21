## Purpose

OD (origin → destination) planning mode for the v0 viewer: replaces the root landing with the mobile-first search experience that uses Google Maps JS as a canvas, Places Autocomplete biased to Colonia urbano, and the local `/api/plan` route from [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) to render a single bus + walking itinerary over the map — the underlying engine is the local OTP GraphQL surface specified in [`otp-routing`](../otp-routing/spec.md). Covers the root-route swap, the Maps JS loader contract, the autocomplete bbox, the polyline + marker render of the first itinerary, the bottom-sheet card (duration, legs, tarifa with `"Consultar al chofer"` fallback), the loading/empty/error states keyed against the i18n catalog, the operator-local-time request construction, and the test coverage rules.

## Requirements

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

### Requirement: The viewer SHALL load Google Maps JS API as a canvas, never as a routing engine

The OD mode SHALL load the Google Maps JavaScript API (with the `places` and `geometry` libraries) on the client to render the canvas, place autocomplete, and encoded-polyline decoding. The viewer SHALL NOT call Google Directions, Google Distance Matrix, or any Transit Partners API in runtime — itinerary computation SHALL come exclusively from the local OTP via [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) `POST /api/plan`. This satisfies the local-first principle of the PRD §5.3.

The API key SHALL be supplied via the environment variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. The key is bundled to the client at build time; security SHALL be enforced via an HTTP referrer restriction configured in Google Cloud Console for the demo domain and `localhost`, NOT by hiding the key string. The key SHALL NOT be logged or surfaced in any API response.

#### Scenario: Maps JS API is loaded with the documented libraries
- **WHEN** the OD mode mounts on the client
- **THEN** the Google Maps JS loader requests at minimum the `places` and `geometry` libraries (so Autocomplete and `decodePath` are available)

#### Scenario: No runtime call to Google Directions / Transit Partners
- **WHEN** the network log is inspected during an OD planning session
- **THEN** no request hits `directions.googleapis.com`, `maps.googleapis.com/maps/api/directions`, or any Transit Partners endpoint; the only Google Maps API traffic is the canvas tile loader and the Places Autocomplete service

#### Scenario: Missing API key surfaces a non-fatal banner instead of a runtime crash
- **WHEN** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset and the OD mode mounts
- **THEN** the OD shell SHALL render an explicit "API key missing" banner (translated via the i18n catalog) in place of the map canvas, and the rest of the chrome (header, disclaimer) SHALL remain functional

### Requirement: The OD search SHALL use Places Autocomplete biased to a Colonia urbano bounding box

The origin and destination inputs of the OD search bar SHALL use the Google Places Autocomplete service constrained to a rectangular bounding box that covers Colonia urbano. The bounding box SHALL match the area documented in the design (`SW: -34.490, -57.870`; `NE: -34.435, -57.800`) and SHALL apply `componentRestrictions: { country: 'uy' }`.

Both inputs SHALL be labelled via i18n keys (`od.search.origin.label`, `od.search.destination.label`) with placeholders (`od.search.origin.placeholder`, `od.search.destination.placeholder`). The user SHALL be able to clear either input independently. Submission of the plan request SHALL be implicit — when both inputs hold a confirmed `Place` (lat/lon resolved) the plan request SHALL fire automatically.

#### Scenario: Autocomplete suggestions stay inside the Colonia bbox
- **WHEN** the user types `"Plaza"` into the origin input
- **THEN** the suggestions returned by Places Autocomplete SHALL be within the Colonia urbano bounding box (e.g., "Plaza Mayor 25 de Mayo", not "Plaza Independencia, Buenos Aires")

#### Scenario: Both endpoints selected triggers a plan request
- **WHEN** the user picks a Place for origin and a Place for destination
- **THEN** the viewer SHALL POST to `/api/plan` exactly once with `{from:{lat,lon}, to:{lat,lon}, date, time}` derived from the selected Places and the current local time

#### Scenario: Clearing an input cancels the in-flight plan
- **WHEN** a plan request is in flight and the user clears the origin or destination input
- **THEN** the in-flight request's result SHALL be discarded (no leg rendered on the map), and the UI SHALL return to the `idle` state

### Requirement: The OD result SHALL render the first itinerary on the map as polylines + markers

When `/api/plan` returns a successful response with at least one itinerary, the OD mode SHALL render the **first** itinerary on the map canvas:
- Each `leg` in the itinerary SHALL be drawn as a Google Maps `Polyline` decoded from `leg.legGeometry.points` via `google.maps.geometry.encoding.decodePath()`. Legs without `legGeometry` (null) SHALL be skipped silently — no polyline for that leg.
- Walking legs SHALL render as a gray dashed polyline (`#6b7280`, opacity `0.6`).
- Bus legs SHALL render in the color assigned to the line's `shortName` via the palette in the design (D-07). Lines without a palette entry SHALL fall back to indigo (`#6366f1`).
- The bus leg's `from.stopId` and `to.stopId` SHALL render as small markers on the map (one marker per boarding/alighting stop). Each `StopMarker` SHALL be clickable. When tapped, the marker SHALL dispatch the click to a parent-provided handler (`onStopClick(stopId: string)`). The OD shell, when wiring `<MapCanvas>`, SHALL connect this handler to the `setMode({type: 'stop-info', stopId})` of the mode hook.

The map viewport SHALL fit the bounding box of the first itinerary's geometries after render so the whole route is visible. The viewport SHALL center on the Colonia urbano default (`-34.467, -57.840`) at zoom `15` when no itinerary is yet selected.

#### Scenario: First itinerary renders one polyline per leg
- **WHEN** `/api/plan` returns an itinerary with three legs (walk → bus → walk)
- **THEN** the map renders three polylines — gray dashed for the walks, the line color for the bus

#### Scenario: Polylines without geometry are skipped without errors
- **WHEN** a leg in the response has `legGeometry: null`
- **THEN** the map SHALL render the remaining legs without throwing, and the itinerary card SHALL still list that leg textually

#### Scenario: Map viewport fits the itinerary bbox after render
- **WHEN** an itinerary is rendered to the map
- **THEN** the map's `bounds` SHALL be the union of all rendered polylines' bounding boxes, with a small padding so the polylines aren't flush against the viewport edges

#### Scenario: Tap on an itinerary stop marker dispatches the mode change
- **WHEN** the user taps a marker for a leg's boarding/alighting stop
- **THEN** the URL hash updates to `#stop=<id>` and the stop-info mode activates while the itinerary remains visible on the map

### Requirement: The OD itinerary card SHALL show duration, legs, and tarifa

A bottom sheet card SHALL display the first itinerary's summary whenever a plan result is rendered:
- **Header**: total duration in minutes and total walking distance in meters (rounded). Both labelled with i18n keys.
- **Legs list**: for each leg, a row with the icon (walking / bus), the duration in minutes, the route's `shortName` (for bus legs), the destination stop name (for bus legs) or street name (for walk legs).
- **Tarifa**: at the bottom — if `itinerary.fare.regular.cents` is present, render `UYU $X.XX` (cents → display); if absent or null, render the fallback i18n key `od.card.fareUnconfirmed` whose Spanish value SHALL be the string `"Consultar al chofer"`.

The card SHALL be dismissible (the user can re-enter the search mode by tapping a close icon or clearing an input) but the rendered polylines on the map SHALL persist until a new search starts.

#### Scenario: Card shows the published fare when fare.regular is set
- **WHEN** the OTP response includes `fare.regular = { cents: 7500, currency: "UYU" }`
- **THEN** the card SHALL render `UYU $75.00` (cents-to-display conversion preserves two decimals)

#### Scenario: Card falls back to "Consultar al chofer" when fare is missing
- **WHEN** the OTP response has `fare: null` (no fare data in `fare_attributes.txt`)
- **THEN** the card SHALL render the i18n key `od.card.fareUnconfirmed` resolving to `"Consultar al chofer"` in Spanish

#### Scenario: Walking leg row shows duration + street, no route
- **WHEN** an itinerary contains a walk leg with `mode: "WALK"`, `durationSeconds: 222`, `to.name: "ITUZAINGO"`
- **THEN** the legs list SHALL render a row labelled "Caminar 4 min hasta ITUZAINGO" (or the i18n-resolved equivalent), with no `shortName` cell

### Requirement: The OD mode SHALL handle loading, empty, and error states with i18n strings

The OD mode SHALL surface four UI states using strings from the catalog (no hardcoded English or Spanish literals):

1. **`idle`** — neither origin nor destination selected yet. The map SHALL render Colonia urbano centered; the bottom sheet SHALL show a hint via `od.state.idleHint`.
2. **`loading`** — a plan request is in flight. The search bar SHALL be disabled; the bottom sheet SHALL show a skeleton card and a localized spinner label via `od.state.loadingLabel`.
3. **`success`** — itinerary rendered on the map + populated card.
4. **`error`** — one of the documented sub-states:
   - `502 otp_unavailable` → `od.state.errorOtp` ("El servicio de planificación no está disponible. Reintentar en un minuto").
   - `400 invalid_request` → `od.state.errorInvalid` ("Origen y destino tienen que estar dentro de Colonia urbano").
   - Successful response with `itineraries: []` → `od.state.errorEmpty` ("No encontramos una opción de viaje para ese trayecto. Probá con un destino cercano").

None of the error copies SHALL leak internal hostnames or paths (per [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-15).

#### Scenario: 502 from /api/plan surfaces the OTP-unavailable copy
- **WHEN** `/api/plan` returns `502 { error: "otp_unavailable" }`
- **THEN** the bottom sheet shows the i18n-resolved value of `od.state.errorOtp` and the error body does NOT contain the strings `"otp:8080"`, `"localhost"`, or any URL fragment

#### Scenario: Empty itineraries array surfaces the empty-route copy
- **WHEN** `/api/plan` returns `200 { itineraries: [] }`
- **THEN** the bottom sheet shows the i18n-resolved value of `od.state.errorEmpty`

#### Scenario: 400 invalid_request from /api/plan surfaces the localised invalid copy
- **WHEN** `/api/plan` returns `400 { error: "invalid_request" }`
- **THEN** the bottom sheet shows the i18n-resolved value of `od.state.errorInvalid`

### Requirement: The OD mode SHALL emit the plan request with the operator-local current time

The plan request SHALL be built with:
- `date`: the current date in `America/Montevideo` formatted `YYYY-MM-DD`.
- `time`: the current time in `America/Montevideo` formatted `HH:MM`, rounded up to the next minute (`now + 1 min`) to leave a margin so OTP does not exclude buses that depart at exactly `now`.
- `from`: `{ lat, lon }` of the resolved origin Place.
- `to`: `{ lat, lon }` of the resolved destination Place.

The viewer SHALL NOT expose any UI control to override the time/date in v0 — that is reserved for v0.1+ per the design's non-goals.

#### Scenario: Request anchors to the operator's local timezone
- **WHEN** the OD mode emits a plan request from a browser running in `Europe/Madrid` at `15:00 CEST` (= `10:00` in Montevideo)
- **THEN** the request body SHALL contain `time: "10:01"` (rounded to next minute) and `date` matching today's date in Montevideo

#### Scenario: Body shape matches /api/plan Zod contract
- **WHEN** the OD mode emits a plan request after the user has picked both endpoints
- **THEN** the body SHALL pass [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-04 validation (`from.lat`, `from.lon`, `to.lat`, `to.lon`, `date`, `time` all present and well-typed)

### Requirement: OD-mode user-facing strings SHALL live in the i18n catalog

Every literal string rendered by the OD mode (button labels, placeholders, hints, error messages, fare fallback, legs labels) SHALL be accessed through `useTranslations()` or `t()` against `viewer/messages/es.json`. Operator-owned data (stop names, headsigns from OTP/GTFS) SHALL stay in Spanish always and SHALL NOT be passed through the i18n catalog (consistent with [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-03 and PRD §3.4).

The catalog SHALL gain a top-level `od` namespace with at least the keys referenced by other requirements in this capability (`od.search.*`, `od.card.*`, `od.state.*`).

#### Scenario: No hardcoded literals in OD components
- **WHEN** any `.tsx` file under `viewer/components/od/` is inspected
- **THEN** every JSX text node is a `t(...)` call or a value derived from the API response (e.g., a stop name from OTP)

#### Scenario: Operator data is not key-ed through i18n
- **WHEN** the legs list shows a stop name like `"INT SUAREZ"` from `/api/plan`'s `to.name`
- **THEN** that value SHALL come straight from the API response and SHALL NOT pass through the i18n catalog

### Requirement: OD-mode components SHALL be covered by the 100% test threshold

The OD-mode code SHALL contribute tests to the existing vitest suite without breaking the 100% line/branch/function/statement threshold enforced by [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-12. Components that touch the Google Maps SDK SHALL be testable by mocking `@vis.gl/react-google-maps` primitives (e.g., replacing `<APIProvider>`, `<Map>`, `<Marker>`, `<Polyline>` with passthrough wrappers that expose their props as DOM attributes); pure helpers (color-by-line, time formatting, bbox math) SHALL be unit-tested directly.

Components that cannot be reasonably tested without a real browser (e.g., the runtime loader itself) MAY be excluded via the vitest `coverage.exclude` list, with the exclusion documented in `vitest.config.ts` next to the existing `components/ui/**` rule.

#### Scenario: `npm test` passes with 100% coverage
- **WHEN** `npm test --coverage` runs in `viewer/`
- **THEN** the run is green and all four coverage metrics report 100%

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

### Requirement: The viewer SHALL expose a line selector entry point to the line-schedule mode

When the active viewer mode is **OD**, the viewer SHALL render a compact line-selector entry point (e.g. a small icon button in the search bar or the header chrome). When this entry point is tapped, the viewer SHALL show the four v0 line chips (3, 4, 5, 8) as the search-slot content (replacing the O→D inputs while the selector is open). Tapping a chip SHALL transition the viewer to the line-schedule mode for that line via `setMode({type:'line-schedule', shortName: '<n>'})`.

When the active mode becomes `line-schedule` (whether via the selector, the chip, or a `#line=<short>` deep link), the OD inputs SHALL NOT appear in the search slot. They reappear when the user returns to the OD mode.

#### Scenario: Selector entry point is visible in OD mode
- **WHEN** the viewer is in the OD mode (default `#` hash)
- **THEN** the search slot shows the O→D inputs plus a small "Líneas" entry point (icon button) on its right side

#### Scenario: Tapping a chip activates line-schedule
- **WHEN** the selector is open and the user taps the chip for `4`
- **THEN** the URL hash becomes `#line=4` and the search slot replaces its content with the line-schedule-mode chrome (the selector itself stays available so the user can switch lines without going back to OD)

### Requirement: The mode hook SHALL track the previously active mode for stop-info push behaviour

The `useViewerMode` hook introduced by [`viewer-stop-info-mode`](../viewer-stop-info-mode/spec.md) SHALL gain a previous-mode field. When `setMode(next, {push: true})` is called, the hook SHALL stash the current mode as previous; on the next `setMode(closeStopInfo)` (typically triggered by closing the stop-info sheet), the hook SHALL restore the stashed mode instead of defaulting to OD.

Only one level of stash is required in v0 — pushing a second stop-info on top of an existing stop-info simply replaces the stash.

#### Scenario: Stop-info pushed on top of line-schedule returns to line-schedule
- **WHEN** the active mode is `line-schedule` for `4` and the user taps a stop, dispatching `setMode({type:'stop-info', stopId: ...}, {push: true})`
- **AND** the user later closes the stop-info sheet (typically `setMode(previous)`)
- **THEN** the mode returns to `{type:'line-schedule', shortName: '4'}` — not to OD
