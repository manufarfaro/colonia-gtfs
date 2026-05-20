import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EmitterService } from '../emitter/emitter.service';
import { PollerService, type Snapshot } from '../poller/poller.service';
import { CLOCK_TOKEN, type Clock } from './clock';

const STALE_THRESHOLD_MS = 120_000;

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

@Controller('gtfs-rt')
export class RtController {
  constructor(
    private readonly poller: PollerService,
    private readonly emitter: EmitterService,
    @Inject(CLOCK_TOKEN) private readonly clock: Clock,
  ) {}

  @Get('vehicle-positions.pb')
  vehiclePositions(@Res() res: Response): void {
    const now = this.clock.now();
    const snapshot = this.effectiveSnapshot(now);
    const buf = this.emitter.buildVehiclePositions(snapshot, now);
    this.sendProto(res, buf);
  }

  @Get('trip-updates.pb')
  tripUpdates(@Res() res: Response): void {
    const now = this.clock.now();
    const snapshot = this.effectiveSnapshot(now);
    const buf = this.emitter.buildTripUpdates(snapshot, now);
    this.sendProto(res, buf);
  }

  private effectiveSnapshot(now: Date): Snapshot {
    const current = this.poller.getSnapshot();
    if (!current.lastSuccessTs) return emptySnapshot();
    const ageMs = now.getTime() - current.lastSuccessTs.getTime();
    return ageMs > STALE_THRESHOLD_MS ? emptySnapshot() : current;
  }

  private sendProto(res: Response, buf: Buffer): void {
    res.set('Content-Type', 'application/x-protobuf').send(buf);
  }
}
