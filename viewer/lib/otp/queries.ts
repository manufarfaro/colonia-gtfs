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

export const LINE_QUERY = `
  query Line($lineId: String!) {
    route(id: $lineId) {
      gtfsId
      shortName
      longName
      patterns {
        directionId
        headsign
        stops { gtfsId name lat lon }
        geometry { points }
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
        legs {
          mode
          duration
          distance
          startTime
          endTime
          realTime
          realtimeState
          route { shortName longName }
          from { name lat lon stop { gtfsId } }
          to { name lat lon stop { gtfsId } }
        }
      }
    }
  }
`;
