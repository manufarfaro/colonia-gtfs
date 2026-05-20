import * as path from 'node:path';
import { GtfsStaticService } from '../gtfs/gtfs-static.service';
import { MatcherService } from './matcher.service';
import type { AvlMarker } from './types';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/fixtures/gtfs-mini');

// 2026-01-05 is a Monday — `weekday` service is active (no holiday exception
// in the mini fixture's calendar_dates for this date).
const WEEKDAY_DATE = '2026-01-05';

async function buildMatcher(): Promise<MatcherService> {
  const gtfs = new GtfsStaticService(FIXTURE_DIR);
  await gtfs.onModuleInit();
  return new MatcherService(gtfs);
}

describe('MatcherService', () => {
  it('R-06 fast-path: marker.srv that equals a trip_id resolves directly', async () => {
    const matcher = await buildMatcher();
    // The fast-path is forward-compatibility: srv literally equals a
    // synthetic trip_id (will rarely fire with today's data but the design
    // pins it).
    const marker: AvlMarker = {
      id: 'BUS-42',
      lin: '4',
      dir: 0,
      lat: 0,
      lon: 0,
      time: new Date(`${WEEKDAY_DATE}T08:00:00-03:00`),
      speed: 0,
      head: 0,
      srv: '4-weekday-0-0800',
    };
    const result = matcher.match(marker, new Date(`${WEEKDAY_DATE}T08:00:00-03:00`));
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.tripId).toBe('4-weekday-0-0800');
      expect(result.via).toBe('srv');
    }
  });

  it('R-06 snap match: marker near a candidate trip stops to the right trip_id', async () => {
    const matcher = await buildMatcher();
    // S3 (INT SUAREZ) is at -34.470578,-57.847103 — at 08:04 trip
    // 4-weekday-0-0800 is exactly there per the fixture stop_times.
    const marker: AvlMarker = {
      id: 'BUS-7',
      lin: '4',
      dir: 0,
      lat: -34.470578,
      lon: -57.847103,
      time: new Date(`${WEEKDAY_DATE}T08:04:00-03:00`),
      speed: 30,
      head: 90,
    };
    const result = matcher.match(marker, new Date(`${WEEKDAY_DATE}T08:04:00-03:00`));
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.tripId).toBe('4-weekday-0-0800');
      expect(result.via).toBe('snap');
      expect(result.distanceMeters).toBeLessThan(50);
    }
  });

  it('R-06 unmatched: marker more than 200 m from any candidate returns null', async () => {
    const matcher = await buildMatcher();
    // Far north of the fixture stops (~5 km away) — no trip should snap.
    const marker: AvlMarker = {
      id: 'BUS-13',
      lin: '4',
      dir: 0,
      lat: -34.4,
      lon: -57.85,
      time: new Date(`${WEEKDAY_DATE}T08:04:00-03:00`),
      speed: 30,
      head: 90,
    };
    const result = matcher.match(marker, new Date(`${WEEKDAY_DATE}T08:04:00-03:00`));
    expect(result.kind).toBe('unmatched');
    if (result.kind === 'unmatched') {
      expect(result.reason).toBe('beyond-threshold');
      expect(result.bestDistanceMeters).toBeGreaterThan(200);
    }
  });
});
