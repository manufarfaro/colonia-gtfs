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
  from: RestLegEnd;
  to: RestLegEnd;
}

export interface RestItinerary {
  durationSeconds: number;
  walkDistanceMeters: number;
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
        legs: ReadonlyArray<{
          mode: string;
          duration: number;
          distance: number;
          startTime: string;
          endTime: string;
          realtimeState: string | null;
          route: { shortName: string; longName: string } | null;
          from: { name: string; lat: number; lon: number; stop: { gtfsId: string } | null };
          to: { name: string; lat: number; lon: number; stop: { gtfsId: string } | null };
        }>;
      }>;
    };
  };
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
      legs: it.legs.map((leg) => ({
        mode: leg.mode as LegMode,
        durationSeconds: leg.duration,
        distanceMeters: leg.distance,
        startTime: leg.startTime,
        endTime: leg.endTime,
        realtimeState: leg.realtimeState as RealtimeState,
        route: leg.route ? { shortName: leg.route.shortName, longName: leg.route.longName } : null,
        from: mapEnd(leg.from),
        to: mapEnd(leg.to),
      })),
    })),
  };
}
