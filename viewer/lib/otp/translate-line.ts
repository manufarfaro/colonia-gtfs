export interface OtpStop {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
}

export interface OtpTrip {
  gtfsId: string;
  stoptimes: { scheduledArrival: number; scheduledDeparture: number }[];
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
  /**
   * Seconds from the trip's first-stop departure to the bus reaching
   * THIS stop. Derived from the canonical pattern's first trip's
   * `scheduledArrival` deltas. The frontend uses it to render a
   * per-stop arrival time relative to any scheduled departure.
   */
  arrivalOffsetSeconds: number;
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

import { CANONICAL_SHAPES } from '@/lib/shapes/canonical-shapes';

function arrivalOffset(
  sampleTrip: OtpTrip | undefined,
  stopIdx: number,
  baseDeparture: number,
): number {
  if (!sampleTrip) return 0;
  const arr = sampleTrip.stoptimes[stopIdx]?.scheduledArrival;
  /* v8 ignore next — sampleTrip filter guarantees stoptimes[stopIdx] exists */
  if (arr === undefined) return 0;
  return Math.max(0, arr - baseDeparture);
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
  const patternsByDir = new Map<number, OtpPattern[]>();
  for (const p of route.patterns) {
    const arr = patternsByDir.get(p.directionId) ?? [];
    arr.push(p);
    patternsByDir.set(p.directionId, arr);
  }

  const directions: RestDirection[] = Array.from(patternsByDir.entries())
    .map(([directionId, patterns]) => {
      const canonical = patterns.reduce(
        (longest, p) => (p.stops.length > longest.stops.length ? p : longest),
        patterns[0],
      );
      // `scheduledDepartures` is the LINE's schedule — when each trip
      // begins at its first stop. Flattening every stoptime would mix in
      // intermediate-stop departure times, ballooning the list into
      // minute-by-minute entries that aren't actual trip starts.
      const allDepartures = patterns
        .flatMap((p) => p.trips)
        .map((t) => t.stoptimes[0]?.scheduledDeparture)
        .filter((s): s is number => typeof s === 'number')
        .sort((a, b) => a - b);
      // Per-stop arrival offset derived from the canonical pattern's
      // first trip with a fully-populated stoptimes list. Each offset
      // is `scheduledArrival[i] - scheduledDeparture[0]`, i.e. seconds
      // from the trip's first-stop departure to reaching stop i.
      const sampleTrip = canonical.trips.find(
        (t) => t.stoptimes.length === canonical.stops.length,
      );
      const baseDeparture = sampleTrip?.stoptimes[0]?.scheduledDeparture ?? 0;
      const stops: RestStop[] = canonical.stops.map((s, i) => ({
        id: s.gtfsId,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        arrivalOffsetSeconds: arrivalOffset(sampleTrip, i, baseDeparture),
      }));
      return {
        directionId,
        headsign: canonical.headsign,
        stops,
        scheduledDepartures: allDepartures.map(secondsToHHMM),
      };
    })
    .sort((a, b) => a.directionId - b.directionId);

  // OTP's `patternGeometry` returns ~one vertex per stop with inter-stop
  // straight-line jumps that look like criss-cross spaghetti at city
  // scale. Override with the AVL-derived canonical shapes baked at
  // build time from `data/shapes.txt`. Fall back to the OTP pattern
  // geometry if no canonical shape is registered for this route.
  const canonical = CANONICAL_SHAPES[route.shortName];
  const shape: RestShape[] = canonical
    ? canonical.map((s) => ({ directionId: s.directionId, points: s.points }))
    : Array.from(patternsByDir.entries())
        .map(([directionId, patterns]) => {
          const withGeom = patterns.filter(
            (p): p is OtpPattern & { patternGeometry: { points: string } } =>
              p.patternGeometry !== null,
          );
          if (withGeom.length === 0) return null;
          const canonicalPattern = withGeom.reduce(
            (longest, p) =>
              p.patternGeometry.points.length > longest.patternGeometry.points.length
                ? p
                : longest,
            withGeom[0],
          );
          return { directionId, points: canonicalPattern.patternGeometry.points };
        })
        .filter((s): s is RestShape => s !== null)
        .sort((a, b) => a.directionId - b.directionId);
  return {
    line: { id: route.gtfsId, shortName: route.shortName, longName: route.longName },
    shape,
    directions,
    meta: { date },
  };
}
