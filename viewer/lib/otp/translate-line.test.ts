import { describe, expect, it } from 'vitest';
import fixture from '@/test/fixtures/otp/line-response.json';
import { translateLineResponse } from './translate-line';

describe('translateLineResponse', () => {
  it('R-06 maps the matching route to { line, shape, directions[] }', () => {
    const result = translateLineResponse(fixture, '999', '2026-05-19');
    expect(result.line).not.toBeNull();
    expect(result.line!.id).toBe('1:999');
    expect(result.line!.shortName).toBe('999');
    expect(result.line!.longName).toBe('Línea 999 — Real de San Carlos');
  });

  it('R-06 returns one shape per direction (encoded polyline from patternGeometry)', () => {
    const result = translateLineResponse(fixture, '999', '2026-05-19');
    expect(result.shape.length).toBe(2);
    expect(result.shape[0].points).toBe('_p~iF~ps|U_ulLnnqC');
  });

  it('R-06 directions carry stops[] and scheduledDepartures[]', () => {
    const result = translateLineResponse(fixture, '999', '2026-05-19');
    expect(result.directions.length).toBe(2);
    expect(result.directions[0].headsign).toBe('Centro');
    expect(result.directions[0].stops.length).toBe(2);
    expect(result.directions[0].scheduledDepartures.length).toBe(2);
    expect(result.directions[0].scheduledDepartures[0]).toMatch(/^\d{2}:\d{2}$/);
  });

  it('R-06 surfaces meta.date in Montevideo TZ', () => {
    const result = translateLineResponse(fixture, '999', '2026-05-19');
    expect(result.meta.date).toBe('2026-05-19');
  });

  it('R-06 returns line: null when OTP returns no matching route', () => {
    const empty = { data: { routes: [] } };
    const result = translateLineResponse(empty, '4', '2026-05-19');
    expect(result.line).toBeNull();
    expect(result.directions).toEqual([]);
    expect(result.shape).toEqual([]);
  });

  it('R-06 returns line: null when only mismatched shortNames come back from partial-match', () => {
    // routes(name: "4") could surface "40" or "44" in a bigger operator.
    // Translator narrows to exact match — none here means line: null.
    const partial = {
      data: { routes: [{ gtfsId: '1:40', shortName: '40', longName: 'L40', patterns: [] }] },
    };
    const result = translateLineResponse(partial, '4', '2026-05-19');
    expect(result.line).toBeNull();
  });

  it('R-06 collapses multiple OTP patterns per direction (keeps the most-stops + longest-geometry one + unions departures)', () => {
    const multi = {
      data: {
        routes: [
          {
            gtfsId: '1:999',
            shortName: '999',
            longName: 'L999',
            patterns: [
              {
                directionId: 0,
                headsign: 'Short turn',
                stops: [{ gtfsId: '1:A', name: 'A', lat: 0, lon: 0 }],
                patternGeometry: { points: 'short' },
                trips: [{ gtfsId: 't1', stoptimes: [{ scheduledDeparture: 28800 }] }],
              },
              {
                directionId: 0,
                headsign: 'Full out',
                stops: [
                  { gtfsId: '1:A', name: 'A', lat: 0, lon: 0 },
                  { gtfsId: '1:B', name: 'B', lat: 0, lon: 0 },
                  { gtfsId: '1:C', name: 'C', lat: 0, lon: 0 },
                ],
                patternGeometry: { points: 'longer-geometry-string' },
                trips: [{ gtfsId: 't2', stoptimes: [{ scheduledDeparture: 32400 }] }],
              },
            ],
          },
        ],
      },
    };
    const result = translateLineResponse(multi, '999', '2026-05-19');
    expect(result.directions).toHaveLength(1);
    expect(result.directions[0].headsign).toBe('Full out');
    expect(result.directions[0].stops).toHaveLength(3);
    expect(result.directions[0].scheduledDepartures).toEqual(['08:00', '09:00']);
    expect(result.shape).toHaveLength(1);
    expect(result.shape[0].points).toBe('longer-geometry-string');
  });

  it('R-06 overrides the shape with the CANONICAL_SHAPES entry when one exists for the line', () => {
    // A minimal route entry for line 3 — the translate function will
    // see this and substitute the bake-time canonical polylines from
    // data/shapes.txt, ignoring whatever (if any) patternGeometry is
    // here.
    const withLine3 = {
      data: {
        routes: [
          {
            gtfsId: '1:3',
            shortName: '3',
            longName: 'Línea 3',
            patterns: [
              {
                directionId: 0,
                headsign: 'R. de San Carlos',
                stops: [{ gtfsId: '1:1', name: 'REAL', lat: 0, lon: 0 }],
                patternGeometry: { points: 'broken-otp-output' },
                trips: [],
              },
            ],
          },
        ],
      },
    };
    const result = translateLineResponse(withLine3, '3', '2026-05-19');
    expect(result.shape).toHaveLength(2);
    expect(result.shape[0].directionId).toBe(0);
    expect(result.shape[1].directionId).toBe(1);
    // Real canonical line-3 shapes encode 79+75 vertices — much longer
    // than the placeholder string above.
    expect(result.shape[0].points.length).toBeGreaterThan(40);
    expect(result.shape[0].points).not.toBe('broken-otp-output');
  });

  it('R-06 computes per-stop arrivalOffsetSeconds from the canonical pattern first trip', () => {
    const withTimes = {
      data: {
        routes: [
          {
            gtfsId: '1:99',
            shortName: '99',
            longName: 'L99',
            patterns: [
              {
                directionId: 0,
                headsign: 'Centro',
                stops: [
                  { gtfsId: 'A', name: 'A', lat: 0, lon: 0 },
                  { gtfsId: 'B', name: 'B', lat: 0, lon: 0 },
                  { gtfsId: 'C', name: 'C', lat: 0, lon: 0 },
                ],
                patternGeometry: null,
                trips: [
                  {
                    gtfsId: 't1',
                    stoptimes: [
                      { scheduledArrival: 28800, scheduledDeparture: 28800 }, // 08:00
                      { scheduledArrival: 29160, scheduledDeparture: 29160 }, // 08:06
                      { scheduledArrival: 29760, scheduledDeparture: 29760 }, // 08:16
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const result = translateLineResponse(withTimes, '99', '2026-05-19');
    expect(result.directions[0].stops[0].arrivalOffsetSeconds).toBe(0);
    expect(result.directions[0].stops[1].arrivalOffsetSeconds).toBe(360);
    expect(result.directions[0].stops[2].arrivalOffsetSeconds).toBe(960);
  });

  it('R-06 falls back to arrivalOffsetSeconds=0 when no trip has full stoptimes', () => {
    const noTrips = {
      data: {
        routes: [
          {
            gtfsId: '1:99',
            shortName: '99',
            longName: 'L99',
            patterns: [
              {
                directionId: 0,
                headsign: 'X',
                stops: [
                  { gtfsId: 'A', name: 'A', lat: 0, lon: 0 },
                  { gtfsId: 'B', name: 'B', lat: 0, lon: 0 },
                ],
                patternGeometry: null,
                trips: [],
              },
            ],
          },
        ],
      },
    };
    const result = translateLineResponse(noTrips, '99', '2026-05-19');
    expect(result.directions[0].stops[0].arrivalOffsetSeconds).toBe(0);
    expect(result.directions[0].stops[1].arrivalOffsetSeconds).toBe(0);
  });

  it('R-06 skips patterns without patternGeometry when building shape', () => {
    const noGeom = {
      data: {
        routes: [
          {
            gtfsId: '1:999',
            shortName: '999',
            longName: 'L999',
            patterns: [
              {
                directionId: 0,
                headsign: 'Centro',
                stops: [],
                patternGeometry: null,
                trips: [],
              },
            ],
          },
        ],
      },
    };
    const result = translateLineResponse(noGeom, '999', '2026-05-19');
    expect(result.shape).toEqual([]);
    expect(result.directions.length).toBe(1);
  });
});
