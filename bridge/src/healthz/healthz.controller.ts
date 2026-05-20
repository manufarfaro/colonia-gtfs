import { Controller, Get, Inject } from '@nestjs/common';
import { PollerService, type Snapshot } from '../poller/poller.service';
import { CLOCK_TOKEN, type Clock } from '../rt/clock';

type Status = 'ok' | 'degraded' | 'down';

interface HealthzPayload {
  status: Status;
  last_poll_ts: string | null;
  last_success_ts: string | null;
  feed_age_seconds: number | null;
  miss_rate_pct: number;
  vehicles_tracked: number;
  vehicles_unmatched: number;
  current_backoff_seconds: number;
}

// Backoff schedule mirrors poller.service.ts (per design D-06).
const BACKOFF_SCHEDULE_SECONDS = [30, 60, 120, 240, 300];

function computeBackoffSeconds(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return BACKOFF_SCHEDULE_SECONDS[0];
  const idx = Math.min(consecutiveFailures, BACKOFF_SCHEDULE_SECONDS.length - 1);
  return BACKOFF_SCHEDULE_SECONDS[idx];
}

function computeMissRatePct(snapshot: Snapshot): number {
  const recent = snapshot.recentOutcomes;
  if (recent.length === 0) return 0;
  const window = recent.slice(-10);
  const failed = window.filter((o) => !o.ok).length;
  return (failed / window.length) * 100;
}

function classify(feedAgeSeconds: number | null, missRatePct: number): Status {
  // Never had a successful poll → down.
  if (feedAgeSeconds === null) return 'down';
  if (feedAgeSeconds > 120 || missRatePct > 50) return 'down';
  if (feedAgeSeconds > 60 || missRatePct > 10) return 'degraded';
  return 'ok';
}

@Controller('healthz')
export class HealthzController {
  constructor(
    private readonly poller: PollerService,
    @Inject(CLOCK_TOKEN) private readonly clock: Clock,
  ) {}

  @Get()
  status(): HealthzPayload {
    const snapshot = this.poller.getSnapshot();
    const now = this.clock.now();
    const feedAgeSeconds = snapshot.lastSuccessTs
      ? Math.floor((now.getTime() - snapshot.lastSuccessTs.getTime()) / 1000)
      : null;
    const missRatePct = computeMissRatePct(snapshot);
    return {
      status: classify(feedAgeSeconds, missRatePct),
      last_poll_ts: snapshot.lastPollTs?.toISOString() ?? null,
      last_success_ts: snapshot.lastSuccessTs?.toISOString() ?? null,
      feed_age_seconds: feedAgeSeconds,
      miss_rate_pct: Number(missRatePct.toFixed(2)),
      vehicles_tracked: snapshot.matchedCount,
      vehicles_unmatched: snapshot.unmatchedCount,
      current_backoff_seconds: computeBackoffSeconds(snapshot.consecutiveFailures),
    };
  }
}
