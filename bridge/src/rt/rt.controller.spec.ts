import { Test } from '@nestjs/testing';
import { transit_realtime } from 'gtfs-realtime-bindings';
import * as path from 'node:path';
import request from 'supertest';
import { GtfsStaticService } from '../gtfs/gtfs-static.service';
import { MatcherService } from '../matcher/matcher.service';
import { EmitterService } from '../emitter/emitter.service';
import { PollerService, type Snapshot } from '../poller/poller.service';
import { CLOCK_TOKEN, type Clock } from './clock';
import { RtController } from './rt.controller';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/fixtures/gtfs-mini');

interface MutablePoller {
  getSnapshot(): Snapshot;
  setSnapshot(s: Snapshot): void;
}

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

async function setupApp(opts: {
  snapshot: Snapshot;
  now: Date;
}): Promise<{ app: import('@nestjs/common').INestApplication; matcher: MatcherService }> {
  const gtfs = new GtfsStaticService(FIXTURE_DIR);
  await gtfs.onModuleInit();
  const matcher = new MatcherService(gtfs);
  const emitter = new EmitterService(gtfs);

  const pollerStub: MutablePoller = {
    getSnapshot: () => opts.snapshot,
    setSnapshot: () => {
      /* unused */
    },
  };

  const clock: Clock = { now: () => opts.now };

  const moduleRef = await Test.createTestingModule({
    controllers: [RtController],
    providers: [
      { provide: PollerService, useValue: pollerStub },
      { provide: EmitterService, useValue: emitter },
      { provide: CLOCK_TOKEN, useValue: clock },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, matcher };
}

describe('RtController', () => {
  describe('GET /gtfs-rt/vehicle-positions.pb', () => {
    it('R-05 returns 200, x-protobuf, body decodes to a FeedMessage', async () => {
      const now = new Date('2026-01-05T08:04:00-03:00');
      const snapshot: Snapshot = {
        ...emptySnapshot(),
        lastPollTs: now,
        lastSuccessTs: now,
      };
      const { app } = await setupApp({ snapshot, now });
      try {
        const res = await request(app.getHttpServer())
          .get('/gtfs-rt/vehicle-positions.pb')
          .responseType('arraybuffer');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/x-protobuf/);
        const fm = transit_realtime.FeedMessage.decode(new Uint8Array(res.body));
        expect(fm.header.gtfsRealtimeVersion).toBe('2.0');
      } finally {
        await app.close();
      }
    });

    it('R-05 returns empty FeedMessage with valid header when last success > 120 s ago', async () => {
      const now = new Date('2026-01-05T08:10:00-03:00');
      const oldSuccess = new Date(now.getTime() - 121_000);
      const snapshot: Snapshot = {
        ...emptySnapshot(),
        lastPollTs: now,
        lastSuccessTs: oldSuccess,
        markers: [
          {
            id: 'V42',
            lin: '4',
            dir: 0,
            lat: -34.470578,
            lon: -57.847103,
            time: oldSuccess,
            speed: 30,
            head: 90,
          },
        ],
        matches: [
          { kind: 'matched', tripId: '4-weekday-0-0800', via: 'snap', distanceMeters: 1 },
        ],
        markersCount: 1,
        matchedCount: 1,
      };
      const { app } = await setupApp({ snapshot, now });
      try {
        const res = await request(app.getHttpServer())
          .get('/gtfs-rt/vehicle-positions.pb')
          .responseType('arraybuffer');
        expect(res.status).toBe(200);
        const fm = transit_realtime.FeedMessage.decode(new Uint8Array(res.body));
        expect(fm.entity).toHaveLength(0);
        expect(fm.header.gtfsRealtimeVersion).toBe('2.0');
        expect(Number(fm.header.timestamp)).toBe(Math.floor(now.getTime() / 1000));
      } finally {
        await app.close();
      }
    });
  });

  describe('GET /gtfs-rt/trip-updates.pb', () => {
    it('R-05 returns 200, x-protobuf, body decodes', async () => {
      const now = new Date('2026-01-05T08:04:00-03:00');
      const snapshot: Snapshot = {
        ...emptySnapshot(),
        lastPollTs: now,
        lastSuccessTs: now,
      };
      const { app } = await setupApp({ snapshot, now });
      try {
        const res = await request(app.getHttpServer())
          .get('/gtfs-rt/trip-updates.pb')
          .responseType('arraybuffer');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/x-protobuf/);
        const fm = transit_realtime.FeedMessage.decode(new Uint8Array(res.body));
        expect(fm.header.gtfsRealtimeVersion).toBe('2.0');
      } finally {
        await app.close();
      }
    });

    it('R-05 trip updates also fall back to empty when stale', async () => {
      const now = new Date('2026-01-05T08:10:00-03:00');
      const snapshot: Snapshot = {
        ...emptySnapshot(),
        lastPollTs: now,
        lastSuccessTs: new Date(now.getTime() - 130_000),
        markers: [
          {
            id: 'V42',
            lin: '4',
            dir: 0,
            lat: -34.470578,
            lon: -57.847103,
            time: new Date(now.getTime() - 130_000),
            speed: 30,
            head: 90,
          },
        ],
        matches: [
          { kind: 'matched', tripId: '4-weekday-0-0800', via: 'snap', distanceMeters: 1 },
        ],
        markersCount: 1,
        matchedCount: 1,
      };
      const { app } = await setupApp({ snapshot, now });
      try {
        const res = await request(app.getHttpServer())
          .get('/gtfs-rt/trip-updates.pb')
          .responseType('arraybuffer');
        expect(res.status).toBe(200);
        const fm = transit_realtime.FeedMessage.decode(new Uint8Array(res.body));
        expect(fm.entity).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });
});
