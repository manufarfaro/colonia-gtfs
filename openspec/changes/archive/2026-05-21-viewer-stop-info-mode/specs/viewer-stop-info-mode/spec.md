## ADDED Requirements

### Requirement: The viewer SHALL expose a tap-on-stop "stop info" mode activated by URL hash `#stop=<gtfsId>`

The viewer SHALL recognise a URL hash of the form `#stop=<gtfsId>` (URL-encoded as needed) as a request to render the stop-info mode for the named stop. The mode MAY also be activated programmatically by tap on a stop marker rendered on the map canvas (see the modified `viewer-od-mode` capability). Closing the mode (back button, close icon, swipe-down on the sheet, or ESC) SHALL return the viewer to the mode previously active (default: OD).

#### Scenario: Deep-link loads the stop-info mode
- **WHEN** the user opens `https://demo/#stop=sol-antigua:3` for the first time
- **THEN** the app renders the chrome + the map canvas + the stop-info bottom sheet for stop `sol-antigua:3`, without first showing the OD mode

#### Scenario: Tapping a stop marker on the map activates the mode
- **WHEN** the user taps a `StopMarker` rendered for an OD itinerary leg
- **THEN** the URL hash updates to `#stop=<id>`, and the stop-info bottom sheet opens for that stop while the existing map content remains visible

#### Scenario: Closing the sheet returns to the previous mode
- **WHEN** the stop-info sheet was opened from the OD mode (or from the `#` empty hash) and the user closes the sheet
- **THEN** the URL hash returns to the prior mode marker (e.g. `#` for OD) and the previously rendered content is intact

### Requirement: The stop-info sheet SHALL render the upcoming arrivals from `/api/stops/:stopId/arrivals`

The sheet SHALL call `GET /api/stops/:stopId/arrivals?limit=10` on open (default limit; respected clamp 1–50 per `viewer-shell-and-api` R-05) and render the response in a list. Each arrival row SHALL surface:
- The line short name (e.g. `"4"`).
- The pattern's headsign (e.g. `"Centro"`) as the destination label.
- The formatted ETA (relative for ≤30 minutes, absolute `HH:MM` thereafter) localised to Spanish.
- A small badge labelled "En vivo" (i18n key `od.stopInfo.arrival.badge.live`) when `arrivals[i].isRealtime === true`, OR a muted "(horario)" suffix (i18n key `od.stopInfo.arrival.badge.scheduled`) when `isRealtime === false`.

The header SHALL show the stop name (from `stop.name` in the response) and the timestamp of the last successful refresh.

#### Scenario: Realtime entries display the live badge
- **WHEN** the response contains an arrival with `isRealtime: true`, `scheduledArrivalIso` 4 minutes in the future
- **THEN** the row shows `Línea 4 · Centro · en 4 min · 🟢 En vivo` (or the i18n-rendered equivalent)

#### Scenario: Scheduled entries are visually de-emphasised
- **WHEN** the response contains an arrival with `isRealtime: false`
- **THEN** the row shows no live badge, the ETA is rendered in the muted-foreground color, and the row carries the i18n value of `od.stopInfo.arrival.badge.scheduled` as a suffix

#### Scenario: ETA formatting switches from relative to absolute at the 30-minute boundary
- **WHEN** the scheduled arrival is 29 minutes away → row reads `en 29 min`
- **AND WHEN** the scheduled arrival is 31 minutes away → row reads the absolute `HH:MM` in `America/Montevideo`

### Requirement: The stop-info card SHALL poll `/api/stops/:stopId/arrivals` every 30 seconds while open

While the stop-info sheet is open and `stopId !== null`, the viewer SHALL refetch the arrivals every 30 seconds. The poll cadence SHALL align with the AVL upstream pull-interval from `bridge-gtfs-rt` R-06 (a tighter cadence would not surface new data). The poll SHALL use an `AbortController` per iteration so that closing the sheet or switching to a different stopId aborts in-flight requests; no traffic SHALL be issued to the endpoint while the mode is not active.

#### Scenario: First open issues one request and then a refresh after 30 seconds
- **WHEN** the user opens the stop-info mode for `sol-antigua:3`
- **THEN** exactly one POST/GET to `/api/stops/sol-antigua:3/arrivals` fires within the first 50 ms, and the next request fires at ~30 seconds (±200 ms tolerance for the timer drift)

#### Scenario: Switching stop aborts the previous poll
- **WHEN** the user is viewing stop `sol-antigua:3` and an in-flight request to `/arrivals` has not yet resolved, and the user navigates to `sol-antigua:7`
- **THEN** the previous request's `AbortController` SHALL be aborted (the underlying fetch's `signal.aborted` is true) and a fresh request fires for the new stopId

#### Scenario: Closing the sheet stops all polling
- **WHEN** the stop-info sheet is closed (mode transitions to anything other than `stop-info`)
- **THEN** the `setInterval` for the poll SHALL be cleared and any pending `AbortController` aborted

### Requirement: The stop-info mode SHALL handle loading, empty, and error states with i18n strings

The sheet SHALL surface four UI states using strings from the catalog (no hardcoded literals):

1. **`loading`** — initial fetch in flight. Skeleton + i18n key `od.stopInfo.state.loading`.
2. **`success`** — list rendered.
3. **`error.empty`** — response is `200 { stop: <known>, arrivals: [] }`. Copy `od.stopInfo.state.errorEmpty` ("No hay próximos buses para esta parada en este momento").
4. **`error.otpUnavailable`** — backend returned `502` or the fetch rejected. Copy `od.stopInfo.state.errorOtp`.
5. **`error.notFound`** — backend returned `404` (deep-link to a stop that does not exist). Copy `od.stopInfo.state.errorNotFound` + a button to return to the OD mode.

No error copy SHALL leak internal hostnames or paths (per [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-15 sanitization).

#### Scenario: 404 on deep-link surfaces the not-found copy + a recovery button
- **WHEN** the user opens `#stop=missing-stop-id` and the backend returns `404`
- **THEN** the sheet shows the i18n value of `od.stopInfo.state.errorNotFound` and a button labelled with `od.stopInfo.state.errorNotFound.returnButton` that, on click, sets the URL hash back to `#` (OD mode)

#### Scenario: Empty arrivals list shows a friendly message rather than an empty list
- **WHEN** the response is `200 { stop: {...}, arrivals: [] }`
- **THEN** the sheet shows the i18n value of `od.stopInfo.state.errorEmpty`, not an empty list region

### Requirement: All stop-info user-facing strings SHALL live in `messages/es.json` under `od.stopInfo.*`

Every literal string rendered by the stop-info mode SHALL be accessed through `t('od.stopInfo.<key>')`. Operator-owned data (stop names, headsigns from OTP/GTFS) SHALL stay in Spanish always and SHALL NOT pass through the i18n catalog (consistent with [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-03 and PRD §3.4).

#### Scenario: No hardcoded literals in stop-info components
- **WHEN** any `.tsx` file under `viewer/components/stop-info/` is inspected
- **THEN** every JSX text node is a `t(...)` call or a value derived from the API response

### Requirement: The stop-info components SHALL satisfy the 100% coverage threshold

The stop-info code SHALL contribute tests to the existing vitest suite without breaking the global 100% line/branch/function/statement threshold of [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-12. Components that touch the Google Maps SDK or browser-only APIs (touch gestures, `window.history.pushState`, etc.) SHALL be either fully testable via mocking (`vi.stubGlobal('history', ...)` for the mode hook), OR excluded with explicit documentation in `vitest.config.ts`.

#### Scenario: `npm test --coverage` stays at 100% after applying this change
- **WHEN** `npm test --coverage` runs in `viewer/`
- **THEN** the run is green and the four global coverage metrics all report 100%
