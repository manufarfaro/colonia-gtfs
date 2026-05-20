export interface OtpStop {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
}

export interface OtpTrip {
  gtfsId: string;
  stoptimes: { scheduledDeparture: number }[];
}

export interface OtpPattern {
  directionId: number;
  headsign: string;
  stops: OtpStop[];
  // OTP 2.10 returns the encoded polyline under `patternGeometry`; the
  // older `geometry` field returns `[Coordinate]` (lat/lon pairs).
  // patternGeometry can be null when OTP has not computed it yet.
  patternGeometry: { points: string } | null;
  trips: OtpTrip[];
}

export interface OtpRoute {
  gtfsId: string;
  shortName: string;
  longName: string;
  patterns: OtpPattern[];
}

export interface OtpRoutesResponse {
  data: {
    routes: OtpRoute[];
  };
}

export interface RestStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface RestDirection {
  directionId: number;
  headsign: string;
  stops: RestStop[];
  scheduledDepartures: string[];
}

export interface RestShape {
  directionId: number;
  points: string;
}

export interface RestLineResponse {
  line: { id: string; shortName: string; longName: string } | null;
  shape: RestShape[];
  directions: RestDirection[];
  meta: { date: string };
}

function secondsToHHMM(secs: number): string {
  const safe = ((secs % 86400) + 86400) % 86400;
  const hh = Math.floor(safe / 3600).toString().padStart(2, '0');
  const mm = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function translateLineResponse(
  raw: OtpRoutesResponse,
  shortName: string,
  date: string,
): RestLineResponse {
  // `routes(name:)` is a partial-match filter in OTP — narrow to an exact
  // shortName hit to avoid surfacing the wrong line when names overlap
  // ("4" could match "40" etc. in a larger operator).
  const route = raw.data.routes.find((r) => r.shortName === shortName) ?? null;
  if (route === null) {
    return { line: null, shape: [], directions: [], meta: { date } };
  }
  const directions: RestDirection[] = route.patterns.map((p) => ({
    directionId: p.directionId,
    headsign: p.headsign,
    stops: p.stops.map((s) => ({ id: s.gtfsId, name: s.name, lat: s.lat, lon: s.lon })),
    scheduledDepartures: p.trips
      .flatMap((t) => t.stoptimes.map((st) => st.scheduledDeparture))
      .sort((a, b) => a - b)
      .map(secondsToHHMM),
  }));
  const shape: RestShape[] = route.patterns
    .filter((p): p is OtpPattern & { patternGeometry: { points: string } } => p.patternGeometry !== null)
    .map((p) => ({
      directionId: p.directionId,
      points: p.patternGeometry.points,
    }));
  return {
    line: { id: route.gtfsId, shortName: route.shortName, longName: route.longName },
    shape,
    directions,
    meta: { date },
  };
}
