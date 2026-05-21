## Purpose

OD (origin → destination) planning mode for the v0 viewer: replaces the root landing with the mobile-first search experience that uses Google Maps JS as a canvas, Places Autocomplete biased to Colonia urbano, and the local `/api/plan` route from [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) to render a single bus + walking itinerary over the map — the underlying engine is the local OTP GraphQL surface specified in [`otp-routing`](../otp-routing/spec.md). Covers the root-route swap, the Maps JS loader contract, the autocomplete bbox, the polyline + marker render of the first itinerary, the bottom-sheet card (duration, legs, tarifa with `"Consultar al chofer"` fallback), the loading/empty/error states keyed against the i18n catalog, the operator-local-time request construction, and the test coverage rules.

## Requirements

### Requirement: The viewer SHALL replace the root page (`/`) with an OD planning mode

The viewer's root route (`app/page.tsx`) SHALL render the OD planning experience as the default landing — replacing the v0 placeholder shipped with [`viewer-shell-and-api`](../viewer-shell-and-api/spec.md) R-02. The chrome persistente (header + disclaimer banner) SHALL remain wrapped around the mode via the existing `app/layout.tsx`. No additional `/plan` or `/results` route SHALL be added in v0; the search state and the resulting itinerary SHALL live as client state within the same route.

#### Scenario: Root renders the OD mode shell
- **WHEN** a client requests `GET /` against a freshly booted viewer
- **THEN** the response is `200`, the HTML contains the chrome persistente, and the body region of `<main>` mounts the OD client shell (search bar + map placeholder) rather than the v0 placeholder copy

#### Scenario: Chrome persistente survives the swap
- **WHEN** the rendered HTML of `GET /` is inspected
- **THEN** the branded header and the disclaimer banner SHALL still be present (i.e., the disclaimer copy `"tarifas a confirmar"` appears in the HTML), and the OD shell does not displace either

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
- The bus leg's `from.stopId` and `to.stopId` SHALL render as small markers on the map (one marker per boarding/alighting stop).

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
