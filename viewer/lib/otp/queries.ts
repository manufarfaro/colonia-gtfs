// OTP 2.10 GraphQL queries. Pinned as string constants — grepable when
// OTP bumps version (per design D-05).

export const ARRIVALS_QUERY = `
  query Arrivals($stopId: String!, $limit: Int!) {
    stop(id: $stopId) {
      gtfsId
      name
      lat
      lon
      stoptimesForServiceDate(numberOfDepartures: $limit) {
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
          stoptimes { scheduledDeparture }
        }
      }
    }
  }
`;

export const PLAN_QUERY = `
  query Plan($from: InputCoordinates!, $to: InputCoordinates!, $date: String!, $time: String!) {
    plan(from: $from, to: $to, date: $date, time: $time, transportModes: [{mode: TRANSIT}, {mode: WALK}]) {
      itineraries {
        duration
        walkDistance
        fare { regular { cents currency } }
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
