## MODIFIED Requirements

### Requirement: `POST /api/plan` SHALL accept Zod-validated bodies and translate OTP responses to a stable REST shape

The viewer SHALL expose `POST /api/plan` as an App Router route handler. The handler SHALL validate the body with a Zod schema; on validation failure it SHALL return `400` with `{ error: "invalid_request", details: [...] }`. Valid bodies SHALL match:

```json
{
  "from": { "lat": -34.4712, "lon": -57.8520 },
  "to":   { "lat": -34.4471, "lon": -57.8147 },
  "date": "2026-05-20",
  "time": "08:30"
}
```

The handler SHALL forward the request to OTP's GraphQL endpoint (`POST /otp/gtfs/v1`) and translate the response to a REST shape:

```json
{
  "itineraries": [
    {
      "durationSeconds": 2735,
      "walkDistanceMeters": 3637.5,
      "fare": { "regular": { "cents": 7500, "currency": "UYU" } },
      "legs": [
        {
          "mode": "WALK",
          "durationSeconds": 222,
          "distanceMeters": 293.31,
          "startTime": "2026-05-20T08:30:45.000Z",
          "endTime": "2026-05-20T08:34:27.000Z",
          "realtimeState": null,
          "route": null,
          "legGeometry": { "points": "_p~iF~ps|U_ulLnnqC" },
          "from": { "name": "Origin",      "lat": -34.4712, "lon": -57.8520, "stopId": null },
          "to":   { "name": "ITUZAINGO",   "lat": -34.4706, "lon": -57.8492, "stopId": "1:2" }
        }
      ]
    }
  ],
  "meta": { "queriedAt": "2026-05-20T11:30:00Z", "otpLatencyMs": 412 }
}
```

`itineraries[].legs[].legGeometry` SHALL be a Google encoded polyline string surfaced from OTP's `legGeometry { points }` GraphQL field, OR `null` when OTP did not compute it for that leg. The viewer SHALL forward the value verbatim — no decoding server-side.

`itineraries[].fare` SHALL surface the OTP `fare { regular { cents, currency } }` value when present in `fare_attributes.txt`, OR `null` when the GTFS fare data is absent. The handler SHALL NOT default a fare value when none is available — `null` is the deterministic signal for the client to render the fallback ("Consultar al chofer", per [`viewer-od-mode`](../viewer-od-mode/spec.md) R-04).

When OTP is unreachable (timeout, connection refused, HTTP 5xx) the handler SHALL return `502 { error: "otp_unavailable" }` and no internal OTP hostname or URL SHALL be surfaced in any field of the response.

#### Scenario: Valid body returns 200 with itineraries including legGeometry and fare
- **WHEN** the client posts a valid body and OTP responds with a plan that has at least one itinerary
- **THEN** the response is `200` with an `itineraries` array whose first entry has the shape above, each leg carries `legGeometry: { points: string } | null`, and the itinerary carries `fare: { regular: ... } | null`

#### Scenario: legGeometry survives leg-by-leg through the translator
- **WHEN** OTP's GraphQL response includes `legGeometry: { points: "<encoded>" }` for a leg
- **THEN** that same encoded string SHALL appear unchanged at `itineraries[i].legs[j].legGeometry.points` in the REST response

#### Scenario: Missing fare data surfaces as null
- **WHEN** the GTFS feed has no `fare_attributes.txt` row for the matched route and OTP returns no `fare` in its plan response
- **THEN** the REST response SHALL emit `itineraries[i].fare: null` (not omitted, not defaulted)

#### Scenario: Invalid body returns 400 with details
- **WHEN** the client posts a body missing `to.lon` or with a non-`YYYY-MM-DD` `date`
- **THEN** the response is `400` with `error: "invalid_request"` and a `details` array describing the failed fields

#### Scenario: OTP unavailable returns 502, sanitized
- **WHEN** the OTP call fails (timeout, ECONNREFUSED, HTTP 5xx)
- **THEN** the response is `502 { error: "otp_unavailable" }` and the body string SHALL NOT contain any OTP hostname, port, or URL fragment

### Requirement: The viewer SHALL serve the OD mode at `/` as its default landing

The root route (`app/page.tsx`) SHALL render the OD planning experience (per [`viewer-od-mode`](../viewer-od-mode/spec.md) R-01) as the default landing in v0. The placeholder `landing.title` / `landing.subtitle` content shipped with the initial `viewer-shell-and-api` apply SHALL be removed from the rendered output — those keys MAY remain in the i18n catalog only if reused by the OD mode itself.

#### Scenario: Root response is the OD mode, not the placeholder
- **WHEN** a client requests `GET /` against a viewer that ships with `viewer-od-mode` applied
- **THEN** the HTML response no longer contains the v0 placeholder copy (`landing.title` / `landing.subtitle`) as the page's main content, and instead carries the OD search bar + map shell wired up
