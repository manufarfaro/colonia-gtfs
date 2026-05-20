import { transit_realtime } from 'gtfs-realtime-bindings';
import type { Snapshot } from '../poller/poller.service';
import { EmitterService } from './emitter.service';
import * as path from 'node:path';
import { GtfsStaticService } from '../gtfs/gtfs-static.service';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/fixtures/gtfs-mini');

function emptySnapshot(): Snapshot {
  return {
    lastPollTs: null,
    lastSuccessTs: null,
    markers: [],
    matches: [],
    markersCount: 0,
    matchedCount: 0,
    unmatchedCount: 0,
    consecutiveFailures: 0,
    recentOutcomes: [],
  };
}

async function buildEmitter(): Promise<EmitterService> {
  const gtfs = new GtfsStaticService(FIXTURE_DIR);
  await gtfs.onModuleInit();
  return new EmitterService(gtfs);
}

describe('EmitterService.buildVehiclePositions', () => {
  it('R-05 builds a FeedMessage with valid v2.0 header and empty entity[] from empty snapshot', async () => {
    const emitter = await buildEmitter();
    const now = new Date('2026-01-05T08:04:00-03:00');
    const buf = emitter.buildVehiclePositions(emptySnapshot(), now);
    const fm = transit_realtime.FeedMessage.decode(buf);
    expect(fm.header.gtfsRealtimeVersion).toBe('2.0');
    expect(fm.header.incrementality).toBe(transit_realtime.FeedHeader.Incrementality.FULL_DATASET);
    expect(Number(fm.header.timestamp)).toBe(Math.floor(now.getTime() / 1000));
    expect(fm.entity).toHaveLength(0);
  });

  it('R-05 emits one VehiclePosition entity per matched marker (skips unmatched)', async () => {
    const emitter = await buildEmitter();
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snapshot: Snapshot = {
      ...emptySnapshot(),
      lastPollTs: now,
      lastSuccessTs: now,
      markers: [
        {
          id: 'V42',
          lin: '4',
          dir: 0,
          lat: -34.470578,
          lon: -57.847103,
          time: now,
          speed: 36,
          head: 90,
        },
        {
          id: 'V99',
          lin: '4',
          dir: 0,
          lat: 0,
          lon: 0,
          time: now,
          speed: 0,
          head: 0,
        },
      ],
      matches: [
        { kind: 'matched', tripId: '4-weekday-0-0800', via: 'snap', distanceMeters: 1 },
        { kind: 'unmatched', reason: 'beyond-threshold', bestDistanceMeters: 9999 },
      ],
      markersCount: 2,
      matchedCount: 1,
      unmatchedCount: 1,
    };
    const buf = emitter.buildVehiclePositions(snapshot, now);
    const fm = transit_realtime.FeedMessage.decode(buf);
    expect(fm.entity).toHaveLength(1);
    const e = fm.entity[0];
    expect(e.vehicle).toBeDefined();
    expect(e.vehicle?.trip?.tripId).toBe('4-weekday-0-0800');
    expect(e.vehicle?.vehicle?.id).toBe('V42');
    expect(e.vehicle?.vehicle?.label).toBe('L4');
    expect(e.vehicle?.position?.latitude).toBeCloseTo(-34.470578, 5);
    expect(e.vehicle?.position?.longitude).toBeCloseTo(-57.847103, 5);
    expect(e.vehicle?.position?.bearing).toBe(90);
    // speed: 36 km/h → 10 m/s
    expect(e.vehicle?.position?.speed).toBeCloseTo(10, 3);
    expect(e.vehicle?.currentStatus).toBe(
      transit_realtime.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO,
    );
  });
});

describe('EmitterService.buildTripUpdates', () => {
  it('R-05 builds a FeedMessage with valid v2.0 header and empty entity[] from empty snapshot', async () => {
    const emitter = await buildEmitter();
    const now = new Date('2026-01-05T08:04:00-03:00');
    const buf = emitter.buildTripUpdates(emptySnapshot(), now);
    const fm = transit_realtime.FeedMessage.decode(buf);
    expect(fm.header.gtfsRealtimeVersion).toBe('2.0');
    expect(fm.entity).toHaveLength(0);
  });

  it('R-05 emits TripUpdate with up to 5 stop_time_update entries with propagated delay', async () => {
    const emitter = await buildEmitter();
    // marker.time = 08:04:30 — that's 30 s late vs trip 4-weekday-0-0800's
    // scheduled 08:04:00 arrival at S3 (sequence 3). Propagated delay 30 s
    // to next stops (S4 seq 4, S5 seq 5).
    const now = new Date('2026-01-05T08:04:30-03:00');
    const markerTime = new Date('2026-01-05T08:04:30-03:00');
    const snapshot: Snapshot = {
      ...emptySnapshot(),
      lastPollTs: now,
      lastSuccessTs: now,
      markers: [
        {
          id: 'V42',
          lin: '4',
          dir: 0,
          lat: -34.470578,
          lon: -57.847103,
          time: markerTime,
          speed: 30,
          head: 90,
        },
      ],
      matches: [{ kind: 'matched', tripId: '4-weekday-0-0800', via: 'snap', distanceMeters: 1 }],
      markersCount: 1,
      matchedCount: 1,
      unmatchedCount: 0,
    };
    const buf = emitter.buildTripUpdates(snapshot, now);
    const fm = transit_realtime.FeedMessage.decode(buf);
    expect(fm.entity).toHaveLength(1);
    const tu = fm.entity[0].tripUpdate;
    expect(tu?.trip.tripId).toBe('4-weekday-0-0800');
    expect(tu?.vehicle?.id).toBe('V42');
    // Trip 4-weekday-0-0800 has 5 stops (S1..S5). At 08:04:30 (after S3
    // sequence 3) the next stops are S4 (4) and S5 (5). Emitter advertises
    // up to 5 next stops; in this 5-stop fixture we get 2 (the remaining).
    expect(tu?.stopTimeUpdate?.length).toBeGreaterThanOrEqual(2);
    expect(tu?.stopTimeUpdate?.length).toBeLessThanOrEqual(5);
    for (const stu of tu?.stopTimeUpdate ?? []) {
      // Delay 30 s propagated to each.
      expect(stu.arrival?.delay).toBe(30);
      expect(stu.departure?.delay).toBe(30);
    }
  });
});
