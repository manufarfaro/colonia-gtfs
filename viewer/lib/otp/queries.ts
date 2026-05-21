// OTP 2.10 GraphQL queries. Pinned as string constants — grepable when
// OTP bumps version (per design D-05).

// OTP 2.10's `stoptimesForServiceDate` requires the `date` argument
// (YYYY-MM-DD); it does NOT accept a `numberOfDepartures` cap (that
// argument exists on `stoptimesForPatterns` instead). The route handler
// caps server-side by slicing in the translator after picking the
// upcoming `limit` arrivals.
export const ARRIVALS_QUERY = `
  query Arrivals($stopId: String!, $date: String!) {
    stop(id: $stopId) {
      gtfsId
      name
      lat
      lon
      stoptimesForServiceDate(date: $date) {
        pattern {
          route { shortName longName }
          headsign
        }
        stoptimes {
          scheduledArrival
          realtimeArrival
          arrivalDelay
          realtime
          realtimeState
        }
      }
    }
  }
`;

// OTP 2.10 notes:
//   - `route(id)` expects the full feed-namespaced ID (e.g. "1:4"); the
//     viewer's public contract takes the human-facing short name ("4")
//     so we lookup via `routes(name: ...)` and take the first match
//     whose shortName matches exactly.
//   - `Pattern.geometry` returns `[Coordinate]` (lat/lon pairs); for the
//     encoded polyline we want `Pattern.patternGeometry { points }`.
export const LINE_QUERY = `
  query Line($shortName: String!) {
    routes(name: $shortName) {
      gtfsId
      shortName
      longName
      patterns {
        directionId
        headsign
        stops { gtfsId name lat lon }
        patternGeometry { points }
        trips {
          gtfsId
          stoptimes { scheduledArrival scheduledDeparture }
        }
      }
    }
  }
`;

// Note: OTP 2.10's GTFS GraphQL replaced the legacy `Itinerary.fare { regular ... }`
// shape with FareProducts on legs. The viewer's REST contract keeps
// `itineraries[i].fare` as an optional (RestFare | null) and the
// translator emits `null` when OTP returns nothing — which triggers the
// PRD §9 plan-B fallback "Consultar al chofer" in the card. Until the
// FareProducts mapping is implemented in a follow-up, we don't request
// the field from OTP (it would fail GraphQL validation and zero the
// whole plan response).
export const PLAN_QUERY = `
  query Plan($from: InputCoordinates!, $to: InputCoordinates!, $date: String!, $time: String!) {
    plan(from: $from, to: $to, date: $date, time: $time, transportModes: [{mode: TRANSIT}, {mode: WALK}]) {
      itineraries {
        duration
        walkDistance
        legs {
          mode
          duration
          distance
          startTime
          endTime
          realTime
          realtimeState
          route { shortName longName }
          legGeometry { points }
          from { name lat lon stop { gtfsId } }
          to { name lat lon stop { gtfsId } }
        }
      }
    }
  }
`;
