import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PollerService, type Snapshot } from '../poller/poller.service';
import { CLOCK_TOKEN, type Clock } from '../rt/clock';
import { HealthzController } from './healthz.controller';

function snapshotAt(opts: {
  lastSuccessAgeMs: number | null;
  failuresOfLast10?: number;
  consecutiveFailures?: number;
  vehiclesTracked?: number;
  vehiclesUnmatched?: number;
  baseInterval?: number;
  now: Date;
}): Snapshot {
  const { lastSuccessAgeMs, now } = opts;
  const lastSuccessTs = lastSuccessAgeMs === null ? null : new Date(now.getTime() - lastSuccessAgeMs);
  const lastPollTs = lastSuccessTs ?? new Date(now.getTime() - 1000);
  const recentOutcomes: { ts: Date; ok: boolean }[] = [];
  const failures = opts.failuresOfLast10 ?? 0;
  for (let i = 0; i < 10 - failures; i++) recentOutcomes.push({ ts: now, ok: true });
  for (let i = 0; i < failures; i++) recentOutcomes.push({ ts: now, ok: false });
  return {
    lastPollTs,
    lastSuccessTs,
    markers: [],
    matches: [],
    markersCount: opts.vehiclesTracked ?? 0,
    matchedCount: opts.vehiclesTracked ?? 0,
    unmatchedCount: opts.vehiclesUnmatched ?? 0,
    consecutiveFailures: opts.consecutiveFailures ?? 0,
    recentOutcomes,
  };
}

async function setupApp(opts: {
  snapshot: Snapshot;
  now: Date;
  pollIntervalMs?: number;
}): Promise<import('@nestjs/common').INestApplication> {
  const pollerStub = { getSnapshot: () => opts.snapshot };
  const clock: Clock = { now: () => opts.now };
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthzController],
    providers: [
      { provide: PollerService, useValue: pollerStub },
      { provide: CLOCK_TOKEN, useValue: clock },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('HealthzController GET /healthz', () => {
  it('R-07 reports `ok` when feed_age <= 60s and miss_rate <= 10%', async () => {
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snap = snapshotAt({
      lastSuccessAgeMs: 10_000,
      failuresOfLast10: 0,
      vehiclesTracked: 5,
      now,
    });
    const app = await setupApp({ snapshot: snap, now });
    try {
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.status).toBe('ok');
      expect(res.body.feed_age_seconds).toBeLessThanOrEqual(60);
      expect(res.body.miss_rate_pct).toBeLessThanOrEqual(10);
      expect(res.body.vehicles_tracked).toBe(5);
      expect(res.body.vehicles_unmatched).toBe(0);
      expect(res.body.current_backoff_seconds).toBe(30);
      expect(res.body.last_success_ts).toBeDefined();
      expect(res.body.last_poll_ts).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('R-07 reports `degraded` when feed_age in (60s, 120s]', async () => {
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snap = snapshotAt({ lastSuccessAgeMs: 90_000, failuresOfLast10: 0, now });
    const app = await setupApp({ snapshot: snap, now });
    try {
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.body.status).toBe('degraded');
      expect(res.body.feed_age_seconds).toBeGreaterThan(60);
      expect(res.body.feed_age_seconds).toBeLessThanOrEqual(120);
    } finally {
      await app.close();
    }
  });

  it('R-07 reports `down` when feed_age > 120s', async () => {
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snap = snapshotAt({ lastSuccessAgeMs: 150_000, failuresOfLast10: 0, now });
    const app = await setupApp({ snapshot: snap, now });
    try {
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.body.status).toBe('down');
      expect(res.body.feed_age_seconds).toBeGreaterThan(120);
    } finally {
      await app.close();
    }
  });

  it('R-07 reports `degraded` when miss_rate in (10%, 50%]', async () => {
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snap = snapshotAt({
      lastSuccessAgeMs: 10_000,
      failuresOfLast10: 3, // 30%
      now,
    });
    const app = await setupApp({ snapshot: snap, now });
    try {
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.body.status).toBe('degraded');
      expect(res.body.miss_rate_pct).toBeGreaterThan(10);
      expect(res.body.miss_rate_pct).toBeLessThanOrEqual(50);
    } finally {
      await app.close();
    }
  });

  it('R-07 reports `down` when miss_rate > 50%', async () => {
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snap = snapshotAt({
      lastSuccessAgeMs: 10_000,
      failuresOfLast10: 7, // 70%
      consecutiveFailures: 3,
      now,
    });
    const app = await setupApp({ snapshot: snap, now });
    try {
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.body.status).toBe('down');
      expect(res.body.miss_rate_pct).toBeGreaterThan(50);
      expect(res.body.current_backoff_seconds).toBe(240);
    } finally {
      await app.close();
    }
  });

  it('R-07 reports `down` when never had a successful poll', async () => {
    const now = new Date('2026-01-05T08:04:00-03:00');
    const snap = snapshotAt({ lastSuccessAgeMs: null, consecutiveFailures: 2, now });
    const app = await setupApp({ snapshot: snap, now });
    try {
      const res = await request(app.getHttpServer()).get('/healthz');
      expect(res.body.status).toBe('down');
      expect(res.body.last_success_ts).toBeNull();
    } finally {
      await app.close();
    }
  });
});
