import { Injectable } from '@nestjs/common';
import { GtfsStaticService } from '../gtfs/gtfs-static.service';
import type { CalendarEntry, StopTime, Trip } from '../gtfs/gtfs-static.service';
import type { AvlMarker, MatchResult } from './types';

const DEFAULT_SNAP_METERS = 200;
const TZ = 'America/Montevideo';
const EARTH_RADIUS_M = 6_371_000;

const DAY_OF_WEEK_KEYS: ReadonlyArray<keyof CalendarEntry['days']> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

interface MontevideoDateParts {
  yyyymmdd: string;
  dayOfWeek: keyof CalendarEntry['days'];
  secondsFromMidnight: number;
}

function montevideoParts(d: Date): MontevideoDateParts {
  // Intl gives us a stable view of the date/time as the operator-local
  // wall clock (America/Montevideo), regardless of the runner's TZ.
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
  const yyyymmdd = `${parts.year}${parts.month}${parts.day}`;
  // 'short' weekday in en-CA produces "Mon", "Tue", etc.
  const weekdayMap: Record<string, keyof CalendarEntry['days']> = {
    Sun: 'sunday',
    Mon: 'monday',
    Tue: 'tuesday',
    Wed: 'wednesday',
    Thu: 'thursday',
    Fri: 'friday',
    Sat: 'saturday',
  };
  const dayOfWeek = weekdayMap[parts.weekday];
  const hour = Number.parseInt(parts.hour, 10);
  const minute = Number.parseInt(parts.minute, 10);
  const second = Number.parseInt(parts.second, 10);
  return {
    yyyymmdd,
    dayOfWeek,
    secondsFromMidnight: hour * 3600 + minute * 60 + second,
  };
}

function parseHms(hms: string): number {
  const [h, m, s] = hms.split(':').map((p) => Number.parseInt(p, 10));
  return h * 3600 + m * 60 + s;
}

function interpolatePosition(
  stopTimes: ReadonlyArray<StopTime>,
  gtfs: GtfsStaticService,
  secondsFromMidnight: number,
): { lat: number; lon: number } | null {
  // Find the bracket [stopTimes[i], stopTimes[i+1]] such that
  // arrival(i) <= secondsFromMidnight < arrival(i+1).
  if (stopTimes.length === 0) return null;
  const firstStop = gtfs.getStop(stopTimes[0].stopId);
  if (!firstStop) return null;
  if (secondsFromMidnight <= parseHms(stopTimes[0].arrivalTime)) {
    return { lat: firstStop.stopLat, lon: firstStop.stopLon };
  }
  const lastStop = gtfs.getStop(stopTimes[stopTimes.length - 1].stopId);
  if (!lastStop) return null;
  if (secondsFromMidnight >= parseHms(stopTimes[stopTimes.length - 1].arrivalTime)) {
    return { lat: lastStop.stopLat, lon: lastStop.stopLon };
  }
  for (let i = 0; i < stopTimes.length - 1; i++) {
    const t0 = parseHms(stopTimes[i].arrivalTime);
    const t1 = parseHms(stopTimes[i + 1].arrivalTime);
    if (secondsFromMidnight >= t0 && secondsFromMidnight < t1) {
      const s0 = gtfs.getStop(stopTimes[i].stopId);
      const s1 = gtfs.getStop(stopTimes[i + 1].stopId);
      if (!s0 || !s1) return null;
      const frac = (secondsFromMidnight - t0) / (t1 - t0);
      return {
        lat: s0.stopLat + (s1.stopLat - s0.stopLat) * frac,
        lon: s0.stopLon + (s1.stopLon - s0.stopLon) * frac,
      };
    }
  }
  return null;
}

@Injectable()
export class MatcherService {
  private readonly snapMaxMeters = DEFAULT_SNAP_METERS;

  constructor(private readonly gtfs: GtfsStaticService) {}

  match(marker: AvlMarker, now: Date): MatchResult {
    // 1. SRV fast-path: marker.srv literally equals a known trip_id.
    if (marker.srv && this.gtfs.getTrip(marker.srv)) {
      return { kind: 'matched', tripId: marker.srv, via: 'srv' };
    }

    // 2. Resolve service_id for `now` in operator-local TZ.
    const parts = montevideoParts(now);
    const activeServices = this.resolveActiveServices(parts.yyyymmdd, parts.dayOfWeek);
    if (activeServices.size === 0) {
      return { kind: 'unmatched', reason: 'no-active-service' };
    }

    // 3. Candidates: trips matching (route_short_name == marker.lin,
    //    direction_id == marker.dir, service_id ∈ activeServices).
    const candidates = this.gtfs
      .getTripsByRouteAndDirection(marker.lin, marker.dir)
      .filter((t) => activeServices.has(t.serviceId));
    if (candidates.length === 0) {
      return { kind: 'unmatched', reason: 'no-candidates' };
    }

    // 4. Snap by distance to the interpolated position at marker.time.
    let best: { trip: Trip; distanceMeters: number } | null = null;
    for (const trip of candidates) {
      const stopTimes = this.gtfs.getStopTimes(trip.tripId);
      const pos = interpolatePosition(stopTimes, this.gtfs, parts.secondsFromMidnight);
      if (!pos) continue;
      const d = haversineMeters(marker.lat, marker.lon, pos.lat, pos.lon);
      if (!best || d < best.distanceMeters) {
        best = { trip, distanceMeters: d };
      }
    }

    if (!best) {
      return { kind: 'unmatched', reason: 'no-candidates' };
    }
    if (best.distanceMeters <= this.snapMaxMeters) {
      return {
        kind: 'matched',
        tripId: best.trip.tripId,
        via: 'snap',
        distanceMeters: best.distanceMeters,
      };
    }
    return {
      kind: 'unmatched',
      reason: 'beyond-threshold',
      bestDistanceMeters: best.distanceMeters,
    };
  }

  private resolveActiveServices(
    yyyymmdd: string,
    dayOfWeek: keyof CalendarEntry['days'],
  ): Set<string> {
    const active = new Set<string>();
    // Iterate calendar.txt entries and apply calendar_dates exceptions.
    for (const serviceId of this.knownServices()) {
      const entry = this.gtfs.getCalendarEntry(serviceId);
      if (!entry) continue;
      if (yyyymmdd < entry.startDate || yyyymmdd > entry.endDate) continue;
      const exception = this.gtfs.getCalendarException(serviceId, yyyymmdd);
      let on = entry.days[dayOfWeek] === 1;
      if (exception === 1) on = true;
      else if (exception === 2) on = false;
      if (on) active.add(serviceId);
    }
    return active;
  }

  private knownServices(): string[] {
    // GtfsStaticService doesn't expose listAll; fall back to the canonical
    // four service ids of the v0 feed.
    return ['weekday', 'saturday', 'sunday', 'holiday'];
  }
}

// Re-export day key list so consumers can iterate if needed.
export { DAY_OF_WEEK_KEYS };
