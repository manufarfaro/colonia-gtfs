## ADDED Requirements

### Requirement: The viewer SHALL expose a line-schedule mode activated by URL hash `#line=<shortName>`

The viewer SHALL recognise `#line=<shortName>` as the URL hash for the line-schedule mode. The mode SHALL also be activated by tap on a chip in the line selector (see modified `viewer-od-mode` requirement below). The mode SHALL stay active until the user navigates away (URL hash changes, back button, or close).

The mode SHALL be **mutually exclusive** with the OD and stop-info modes in v0 — only one is rendered at a time.

#### Scenario: Deep-link loads the line-schedule mode
- **WHEN** the user opens `https://demo/#line=4` for the first time
- **THEN** the app renders the chrome + the map canvas with the line 4 trazado/stops/vehicles + the line-schedule bottom sheet with the day's scheduled departures, without first showing the OD mode

#### Scenario: Tapping a chip in the selector activates the mode
- **WHEN** the line selector is visible (entry path from any other mode) and the user taps the chip for line `4`
- **THEN** the URL hash updates to `#line=4` and the mode activates

### Requirement: The map canvas SHALL render the full line layer (both directions + stops + live vehicles)

When the line-schedule mode is active, `MapCanvas` SHALL render an additional **line layer** composed of:
- One `<Polyline>` per direction, decoded from `directions[i].patternGeometry.points` (per [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-06), with `strokeColor` taken from `getLineColor(shortName)`.
- One `<StopMarker>` per stop in each direction.
- Live `<VehicleMarker>` instances polled every 15 seconds from `/api/lines/:lineId/vehicles` (per [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-07), one marker per `vehicles[i]`.

The viewport SHALL fit the bounding box of the line's directions (union of all polyline coordinates) at mode entry. Vehicle markers SHALL re-render on each poll without remounting the stop markers or the polylines (use `key={vehicle.id}` for stability).

#### Scenario: Direction polylines and stop markers render at line entry
- **WHEN** the line-schedule mode activates for `4` and `/api/lines/4` returns 2 directions with 35 stops total
- **THEN** the map renders 2 polylines (blue for line 4) + 35 stop markers

#### Scenario: Vehicle markers refresh on each poll
- **WHEN** the mode has been active for 30 seconds and `/api/lines/4/vehicles` has been polled twice
- **THEN** the second poll's vehicle positions update their markers in place — no full layer remount

#### Scenario: Empty vehicles array is handled gracefully (no map flicker)
- **WHEN** `/api/lines/4/vehicles` returns `{vehicles: [], meta: {realtime_available: false}}` (bridge unreachable per `viewer-shell-and-api` R-07)
- **THEN** the line trazado + stops continue to render; no vehicle markers appear; the sheet header optionally shows a small "Sin posiciones en vivo" indicator (i18n key `od.lineSchedule.vehicles.noLive`)

### Requirement: The line-schedule sheet SHALL render the day's scheduled departures grouped by direction

The bottom sheet for the line-schedule mode SHALL render:
- A header with the line's `shortName` + `longName` from `/api/lines/:lineId`.
- A set of **tabs**, one per direction in `directions[]` (default: tab `directionId === 0` selected).
- Each tab content: the list of `scheduledDepartures` (formatted `HH:MM` strings already provided by R-06) for that direction, in chronological order.

If only one direction is returned, no tab list SHALL be rendered (a single direction means no choice for the user to make).

#### Scenario: Tabs are labelled with the direction's headsign
- **WHEN** `directions[]` has two entries with headsigns `"Centro"` and `"Real de San Carlos"`
- **THEN** the sheet renders two tabs labelled `"Centro"` and `"Real de San Carlos"`; the `directionId: 0` tab is selected by default

#### Scenario: Scheduled departures render in chronological order
- **WHEN** a direction's `scheduledDepartures` is `["06:00", "06:30", "07:00", ...]`
- **THEN** the tab content lists these strings in the same order, no resorting or filtering

#### Scenario: Stop names in the tab are passed straight from OTP, never translated
- **WHEN** the tab also shows the stops along the route (or any stop name string)
- **THEN** each stop name comes verbatim from the OTP response's `stops[i].name` field, with no detour through the i18n catalog

### Requirement: Tap-on-stop within the line-schedule mode SHALL push the stop-info mode

When the user taps a stop marker (whether inside the line-schedule map layer or in the sheet's stop list) while the line-schedule mode is active, the viewer SHALL push the stop-info mode for that stop. Closing the stop-info sheet SHALL return to the line-schedule mode (NOT to OD).

This requires the mode hook to track the **previously active mode** so that the close handler can restore it.

#### Scenario: Stop-info opens on top of line-schedule
- **WHEN** the user is in `#line=4` and taps a stop marker
- **THEN** the URL hash updates to `#stop=<id>` and the stop-info sheet opens

#### Scenario: Closing the stop-info sheet returns to the line-schedule mode
- **WHEN** the stop-info mode was pushed on top of line-schedule, and the user closes the stop-info sheet
- **THEN** the URL hash returns to `#line=4` (the previously active line-schedule) and the map continues to show line 4's trazado, stops, and vehicles

### Requirement: The line-schedule mode SHALL poll `/api/lines/:lineId/vehicles` every 15 seconds while active

The poll cadence SHALL be **15 s** — not 30 — to match the OTP `vehicle-positions` updater frequency declared in [`otp-routing`](../../specs/otp-routing/spec.md) R-05 (and to keep the marker movement visually smooth). The poll SHALL use an `AbortController` per iteration so that switching lines or exiting the mode cancels in-flight requests.

`/api/lines/:lineId` itself is fetched **once per mode entry** — the in-app cache is unnecessary because the route handler already applies a 60s TTL cache (`viewer-shell-and-api` R-06).

#### Scenario: Vehicles poll cadence is 15 s
- **WHEN** the line-schedule mode is active for 60 s
- **THEN** `/api/lines/:lineId/vehicles` has been requested ~4 times (1 at entry + 3 at the 15s/30s/45s intervals, ±200ms tolerance)

#### Scenario: Switching line aborts the previous poll
- **WHEN** the user is viewing `#line=4` and switches to `#line=5` mid-poll
- **THEN** the in-flight request for `4` aborts (its `signal.aborted` is true) and a fresh poll starts for `5`

### Requirement: All line-schedule user-facing strings SHALL live in `messages/es.json` under `od.lineSchedule.*`

Every literal string rendered by the line-schedule mode SHALL be accessed via `t('od.lineSchedule.<key>')`. Operator data (line `shortName`/`longName`, stop names, headsigns) SHALL stay in the original Spanish from the feed, no detour through the catalog.

#### Scenario: No hardcoded literals in line-schedule components
- **WHEN** any `.tsx` file under `viewer/components/line-schedule/` is inspected
- **THEN** every JSX text node is a `t(...)` call or a value derived from the API response

### Requirement: The line-schedule components SHALL satisfy the 100% coverage threshold

The line-schedule code SHALL contribute tests to the vitest suite without breaking the global 100% threshold of [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-12. `VehicleMarker.tsx`, `LineRouteLayer.tsx`, and any other component that instances `google.maps.*` runtime primitives directly MAY be excluded with a documented entry in `vitest.config.ts` (following the precedent of `OdAutocompleteInput` and `LegPolyline` from `viewer-od-mode`). All hooks, the sheet/tab logic, the selector, and the scheduled-departures rendering SHALL be testable under happy-dom.

#### Scenario: `npm test --coverage` stays at 100% after applying this change
- **WHEN** `npm test --coverage` runs in `viewer/`
- **THEN** the run is green and the four global coverage metrics all report 100%
