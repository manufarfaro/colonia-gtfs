// Translates the OTP GraphQL `plan` response into the REST shape the
// viewer client consumes. See spec R-04 for the contract.

export type LegMode = 'WALK' | 'BUS';
export type RealtimeState = 'SCHEDULED' | 'UPDATED' | null;

export interface RestLegEnd {
  name: string;
  lat: number;
  lon: number;
  stopId: string | null;
}

export interface RestRoute {
  shortName: string;
  longName: string;
}

export interface RestLeg {
  mode: LegMode;
  durationSeconds: number;
  distanceMeters: number;
  startTime: string;
  endTime: string;
  realtimeState: RealtimeState;
  route: RestRoute | null;
  /** OTP-provided trip direction (0 or 1) for BUS legs. `null` for
   *  walk legs and when OTP omits the field. Used to filter realtime
   *  vehicles on the map to those doing the SAME direction as the
   *  rider's bus segment — line 4 is a loop, the OUTBOUND bus is on
   *  the OPPOSITE side of the city from the INBOUND one. */
  directionId: number | null;
  /** Headsign of the specific trip the leg uses (e.g., "Centro (x Los
   *  Nogales)"). Mostly informational; the directionId is what we
   *  filter on. */
  tripHeadsign: string | null;
  // Google encoded polyline string. `null` when OTP did not compute the
  // geometry for this leg (the OD-mode client skips the polyline render
  // for that leg, the leg row still appears in the itinerary card).
  legGeometry: { points: string } | null;
  from: RestLegEnd;
  to: RestLegEnd;
}

export interface RestFare {
  regular: { cents: number; currency: string };
}

export interface RestItinerary {
  durationSeconds: number;
  walkDistanceMeters: number;
  // `null` when fare_attributes.txt has no row for the matched route. The
  // OD-mode client renders the documented "Consultar al chofer" fallback.
  fare: RestFare | null;
  legs: RestLeg[];
}

export interface RestPlanResponse {
  itineraries: RestItinerary[];
}

interface OtpPlanResponse {
  data?: {
    plan?: {
      itineraries?: ReadonlyArray<{
        duration: number;
        walkDistance: number;
        fare?: { regular?: { cents: number; currency: string } | null } | null;
        legs: ReadonlyArray<{
          mode: string;
          duration: number;
          distance: number;
          startTime: string;
          endTime: string;
          realtimeState: string | null;
          route: { shortName: string; longName: string } | null;
          trip?: { directionId?: string | number | null; tripHeadsign?: string | null } | null;
          legGeometry?: { points: string } | null;
          from: { name: string; lat: number; lon: number; stop: { gtfsId: string } | null };
          to: { name: string; lat: number; lon: number; stop: { gtfsId: string } | null };
        }>;
      }>;
    };
  };
}

function parseDirectionId(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function mapEnd(e: {
  name: string;
  lat: number;
  lon: number;
  stop: { gtfsId: string } | null;
}): RestLegEnd {
  return {
    name: e.name,
    lat: e.lat,
    lon: e.lon,
    stopId: e.stop?.gtfsId ?? null,
  };
}

export function translatePlanResponse(raw: OtpPlanResponse): RestPlanResponse {
  const itineraries = raw.data?.plan?.itineraries ?? [];
  return {
    itineraries: itineraries.map((it) => ({
      durationSeconds: it.duration,
      walkDistanceMeters: it.walkDistance,
      fare: it.fare?.regular ? { regular: it.fare.regular } : null,
      legs: it.legs.map((leg) => ({
        mode: leg.mode as LegMode,
        durationSeconds: leg.duration,
        distanceMeters: leg.distance,
        startTime: leg.startTime,
        endTime: leg.endTime,
        realtimeState: leg.realtimeState as RealtimeState,
        route: leg.route ? { shortName: leg.route.shortName, longName: leg.route.longName } : null,
        directionId: parseDirectionId(leg.trip?.directionId),
        tripHeadsign: leg.trip?.tripHeadsign ?? null,
        legGeometry: leg.legGeometry ?? null,
        from: mapEnd(leg.from),
        to: mapEnd(leg.to),
      })),
    })),
  };
}
