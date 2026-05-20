// Translates the OTP GraphQL `stop(...).stoptimesForServiceDate` response
// into the REST shape consumed by the viewer (spec R-05).

export interface RestArrivalsStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface RestArrival {
  lineShortName: string;
  headsign: string;
  scheduledArrivalIso: string;
  expectedArrivalIso: string;
  delaySeconds: number;
  isRealtime: boolean;
}

export interface RestArrivalsResponse {
  stop: RestArrivalsStop | null;
  arrivals: RestArrival[];
  meta: { queriedAt: string; realtime_available: boolean };
}

interface OtpArrivalsResponse {
  data?: {
    stop?: {
      gtfsId: string;
      name: string;
      lat: number;
      lon: number;
      stoptimesForServiceDate?: ReadonlyArray<{
        pattern: {
          route: { shortName: string; longName: string };
          headsign: string;
        };
        stoptimes: ReadonlyArray<{
          scheduledArrival: number;
          realtimeArrival: number;
          arrivalDelay: number;
          realtime: boolean;
          realtimeState: string;
        }>;
      }>;
    } | null;
  };
}

/** Convert (date YYYY-MM-DD, seconds-from-midnight UTC) to ISO-8601 string. */
function secondsToIso(date: string, seconds: number): string {
  // OTP returns seconds-since-midnight in operator-local time. Compose
  // with date in America/Montevideo (UTC-3 fixed) and return ISO UTC.
  const [y, m, d] = date.split('-').map(Number);
  const totalMin = Math.floor(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const mi = totalMin % 60;
  const s = seconds % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}-03:00`).toISOString();
}

export function translateArrivalsResponse(
  raw: OtpArrivalsResponse,
  date: string,
): RestArrivalsResponse {
  const stop = raw.data?.stop;
  const queriedAt = new Date().toISOString();
  if (!stop) {
    return { stop: null, arrivals: [], meta: { queriedAt, realtime_available: false } };
  }
  const arrivals: RestArrival[] = [];
  for (const item of stop.stoptimesForServiceDate ?? []) {
    for (const st of item.stoptimes) {
      arrivals.push({
        lineShortName: item.pattern.route.shortName,
        headsign: item.pattern.headsign,
        scheduledArrivalIso: secondsToIso(date, st.scheduledArrival),
        expectedArrivalIso: secondsToIso(date, st.realtimeArrival),
        delaySeconds: st.arrivalDelay,
        isRealtime: st.realtime,
      });
    }
  }
  const realtimeAvailable = arrivals.some((a) => a.isRealtime);
  return {
    stop: { id: stop.gtfsId, name: stop.name, lat: stop.lat, lon: stop.lon },
    arrivals,
    meta: { queriedAt, realtime_available: realtimeAvailable },
  };
}
