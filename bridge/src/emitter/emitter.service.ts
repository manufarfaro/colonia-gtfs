import { Injectable } from '@nestjs/common';
import { transit_realtime } from 'gtfs-realtime-bindings';
import { GtfsStaticService } from '../gtfs/gtfs-static.service';
import type { StopTime } from '../gtfs/gtfs-static.service';
import type { Snapshot } from '../poller/poller.service';
import type { AvlMarker, MatchResult } from '../matcher/types';

const FEED_ID = 'sol-antigua';
const NEXT_STOPS_LIMIT = 5;

function unixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

function header(now: Date): transit_realtime.IFeedHeader {
  return {
    gtfsRealtimeVersion: '2.0',
    incrementality: transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
    timestamp: unixSeconds(now),
  };
}

interface MatchedMarker {
  marker: AvlMarker;
  tripId: string;
}

function matchedOnly(markers: AvlMarker[], matches: MatchResult[]): MatchedMarker[] {
  const out: MatchedMarker[] = [];
  for (let i = 0; i < markers.length; i++) {
    const m = matches[i];
    if (m && m.kind === 'matched') {
      out.push({ marker: markers[i], tripId: m.tripId });
    }
  }
  return out;
}

function ymdLocal(d: Date): string {
  // YYYYMMDD per GTFS-RT TripDescriptor.start_date convention.
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

function parseHms(hms: string): number {
  const [h, m, s] = hms.split(':').map((p) => Number.parseInt(p, 10));
  return h * 3600 + m * 60 + s;
}

function localSecondsFromMidnight(d: Date): number {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
  return (
    Number.parseInt(parts.hour, 10) * 3600 +
    Number.parseInt(parts.minute, 10) * 60 +
    Number.parseInt(parts.second, 10)
  );
}

@Injectable()
export class EmitterService {
  constructor(private readonly gtfs: GtfsStaticService) {}

  buildVehiclePositions(snapshot: Snapshot, now: Date): Buffer {
    const matched = matchedOnly(snapshot.markers, snapshot.matches);
    const entities: transit_realtime.IFeedEntity[] = matched.map(({ marker, tripId }) => {
      const trip = this.gtfs.getTrip(tripId);
      const stopTimes = this.gtfs.getStopTimes(tripId);
      const nextStopIdx = findNextStopIndex(marker, stopTimes);
      const stopId = nextStopIdx !== null ? stopTimes[nextStopIdx].stopId : undefined;
      const stopSequence = nextStopIdx !== null ? stopTimes[nextStopIdx].stopSequence : undefined;
      return {
        id: `vp-${marker.id}`,
        vehicle: {
          trip: {
            tripId,
            routeId: trip?.routeId,
            startDate: ymdLocal(marker.time),
            scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
          },
          vehicle: { id: marker.id, label: `L${marker.lin}` },
          position: {
            latitude: marker.lat,
            longitude: marker.lon,
            bearing: marker.head,
            speed: marker.speed / 3.6, // km/h → m/s
          },
          currentStatus: transit_realtime.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO,
          currentStopSequence: stopSequence,
          stopId,
          timestamp: unixSeconds(marker.time),
        },
      };
    });
    const fm = transit_realtime.FeedMessage.create({
      header: header(now),
      entity: entities,
    });
    return Buffer.from(transit_realtime.FeedMessage.encode(fm).finish());
  }

  buildTripUpdates(snapshot: Snapshot, now: Date): Buffer {
    const matched = matchedOnly(snapshot.markers, snapshot.matches);
    const entities: transit_realtime.IFeedEntity[] = matched.map(({ marker, tripId }) => {
      const trip = this.gtfs.getTrip(tripId);
      const stopTimes = this.gtfs.getStopTimes(tripId);
      const delaySeconds = computeDelaySeconds(marker, stopTimes);
      const nextStopIdx = findNextStopIndex(marker, stopTimes);
      const stopTimeUpdate: transit_realtime.TripUpdate.IStopTimeUpdate[] = [];
      if (nextStopIdx !== null) {
        const slice = stopTimes.slice(nextStopIdx, nextStopIdx + NEXT_STOPS_LIMIT);
        for (const st of slice) {
          stopTimeUpdate.push({
            stopId: st.stopId,
            stopSequence: st.stopSequence,
            arrival: { delay: delaySeconds },
            departure: { delay: delaySeconds },
            scheduleRelationship:
              transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED,
          });
        }
      }
      return {
        id: `tu-${marker.id}`,
        tripUpdate: {
          trip: {
            tripId,
            routeId: trip?.routeId,
            startDate: ymdLocal(marker.time),
            scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
          },
          vehicle: { id: marker.id, label: `L${marker.lin}` },
          stopTimeUpdate,
          timestamp: unixSeconds(marker.time),
        },
      };
    });
    const fm = transit_realtime.FeedMessage.create({
      header: header(now),
      entity: entities,
    });
    return Buffer.from(transit_realtime.FeedMessage.encode(fm).finish());
  }
}

function findNextStopIndex(marker: AvlMarker, stopTimes: ReadonlyArray<StopTime>): number | null {
  if (stopTimes.length === 0) return null;
  const markerSec = localSecondsFromMidnight(marker.time);
  for (let i = 0; i < stopTimes.length; i++) {
    if (markerSec < parseHms(stopTimes[i].arrivalTime)) {
      return i;
    }
  }
  return null; // already past the last stop
}

function computeDelaySeconds(marker: AvlMarker, stopTimes: ReadonlyArray<StopTime>): number {
  if (stopTimes.length === 0) return 0;
  const markerSec = localSecondsFromMidnight(marker.time);
  // Find the last stop the marker has passed (latest arrivalTime <= markerSec).
  let lastPassed: StopTime | null = null;
  for (const st of stopTimes) {
    if (parseHms(st.arrivalTime) <= markerSec) lastPassed = st;
    else break;
  }
  if (!lastPassed) {
    // Marker is before the first stop — early by some amount; report as negative delay.
    return markerSec - parseHms(stopTimes[0].arrivalTime);
  }
  return markerSec - parseHms(lastPassed.arrivalTime);
}

// Avoid "FEED_ID is unused" if FEED_ID is later imported elsewhere.
export { FEED_ID };
