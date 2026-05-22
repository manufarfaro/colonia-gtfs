import { describe, expect, it } from 'vitest';
import fixture from '../../test/fixtures/otp/plan-response.json' with { type: 'json' };
import { translatePlanResponse } from './translate-plan';

describe('translatePlanResponse', () => {
  it('R-04 maps every itinerary into REST shape with durationSeconds + walkDistanceMeters', () => {
    const out = translatePlanResponse(fixture);
    expect(out.itineraries).toHaveLength(2);
    expect(out.itineraries[0].durationSeconds).toBe(2735);
    expect(out.itineraries[0].walkDistanceMeters).toBeCloseTo(3637.5);
    expect(out.itineraries[1].durationSeconds).toBe(2211);
  });

  it('R-04 maps legs preserving mode, duration, distance, and route.shortName when present', () => {
    const out = translatePlanResponse(fixture);
    const busLeg = out.itineraries[1].legs.find((l) => l.mode === 'BUS');
    expect(busLeg).toBeDefined();
    expect(busLeg!.durationSeconds).toBe(404);
    expect(busLeg!.distanceMeters).toBeCloseTo(1825.2);
    expect(busLeg!.route).toEqual({ shortName: '4', longName: 'Línea 4' });
    expect(busLeg!.realtimeState).toBe('UPDATED');
  });

  it('R-04 walk legs have null route and null realtimeState', () => {
    const out = translatePlanResponse(fixture);
    const walkLeg = out.itineraries[0].legs[0];
    expect(walkLeg.mode).toBe('WALK');
    expect(walkLeg.route).toBeNull();
    expect(walkLeg.realtimeState).toBeNull();
  });

  it('R-04 from/to surfaces stop.gtfsId when present, null otherwise', () => {
    const out = translatePlanResponse(fixture);
    const busLeg = out.itineraries[1].legs.find((l) => l.mode === 'BUS')!;
    expect(busLeg.from.stopId).toBe('sol-antigua:2');
    const walkLegOrigin = out.itineraries[0].legs[0];
    expect(walkLegOrigin.from.stopId).toBeNull();
  });

  it('R-04 returns empty itineraries array when OTP returns plan with no itineraries', () => {
    const empty = { data: { plan: { itineraries: [] } } };
    const out = translatePlanResponse(empty);
    expect(out.itineraries).toEqual([]);
  });

  it('R-04 returns empty itineraries array when OTP omits plan/itineraries entirely', () => {
    // Exercises the `?? []` default branch — plan.itineraries undefined.
    const out = translatePlanResponse({ data: { plan: {} } });
    expect(out.itineraries).toEqual([]);
  });

  it('R-04 surfaces legGeometry.points verbatim per leg (or null when OTP omits)', () => {
    const out = translatePlanResponse(fixture);
    const itin = out.itineraries[1];
    expect(itin.legs[0].legGeometry).toEqual({ points: 'abcde123' });
    expect(itin.legs[1].legGeometry).toEqual({ points: 'busgeom01' });
    expect(itin.legs[2].legGeometry).toBeNull();
  });

  it('R-04 surfaces fare.regular when present and null when absent (no defaulting)', () => {
    const out = translatePlanResponse(fixture);
    expect(out.itineraries[0].fare).toBeNull();
    expect(out.itineraries[1].fare).toEqual({ regular: { cents: 7500, currency: 'UYU' } });
  });

  it('R-04 leg carries directionId + tripHeadsign from OTP trip block', () => {
    const raw = {
      data: {
        plan: {
          itineraries: [
            {
              duration: 100,
              walkDistance: 50,
              legs: [
                {
                  mode: 'BUS',
                  duration: 100,
                  distance: 1000,
                  startTime: '2026-01-05T08:00:00Z',
                  endTime: '2026-01-05T08:10:00Z',
                  realtimeState: 'SCHEDULED',
                  route: { shortName: '4', longName: 'L4' },
                  trip: { directionId: '1', tripHeadsign: 'Centro' },
                  legGeometry: { points: 'abc' },
                  from: { name: 'A', lat: 0, lon: 0, stop: null },
                  to: { name: 'B', lat: 0, lon: 0, stop: null },
                },
                {
                  mode: 'BUS',
                  duration: 100,
                  distance: 1000,
                  startTime: '2026-01-05T08:00:00Z',
                  endTime: '2026-01-05T08:10:00Z',
                  realtimeState: 'SCHEDULED',
                  route: { shortName: '5', longName: 'L5' },
                  // numeric direction; tripHeadsign omitted
                  trip: { directionId: 0 },
                  legGeometry: null,
                  from: { name: 'A', lat: 0, lon: 0, stop: null },
                  to: { name: 'B', lat: 0, lon: 0, stop: null },
                },
                {
                  mode: 'WALK',
                  duration: 60,
                  distance: 100,
                  startTime: '2026-01-05T08:00:00Z',
                  endTime: '2026-01-05T08:01:00Z',
                  realtimeState: null,
                  route: null,
                  // walk legs have no trip
                  trip: null,
                  legGeometry: null,
                  from: { name: 'A', lat: 0, lon: 0, stop: null },
                  to: { name: 'B', lat: 0, lon: 0, stop: null },
                },
                {
                  mode: 'BUS',
                  duration: 100,
                  distance: 1000,
                  startTime: '2026-01-05T08:00:00Z',
                  endTime: '2026-01-05T08:10:00Z',
                  realtimeState: 'SCHEDULED',
                  route: { shortName: '6', longName: 'L6' },
                  // OTP returned a non-numeric directionId (defensive)
                  trip: { directionId: 'NaN' },
                  legGeometry: null,
                  from: { name: 'A', lat: 0, lon: 0, stop: null },
                  to: { name: 'B', lat: 0, lon: 0, stop: null },
                },
              ],
            },
          ],
        },
      },
    };
    const out = translatePlanResponse(raw);
    expect(out.itineraries[0].legs[0].directionId).toBe(1);
    expect(out.itineraries[0].legs[0].tripHeadsign).toBe('Centro');
    expect(out.itineraries[0].legs[1].directionId).toBe(0);
    expect(out.itineraries[0].legs[1].tripHeadsign).toBeNull();
    expect(out.itineraries[0].legs[2].directionId).toBeNull();
    expect(out.itineraries[0].legs[2].tripHeadsign).toBeNull();
    expect(out.itineraries[0].legs[3].directionId).toBeNull();
  });
});
