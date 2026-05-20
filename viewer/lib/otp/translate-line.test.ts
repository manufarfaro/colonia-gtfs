import { describe, expect, it } from 'vitest';
import fixture from '@/test/fixtures/otp/line-response.json';
import { translateLineResponse } from './translate-line';

describe('translateLineResponse', () => {
  it('R-06 maps the matching route to { line, shape, directions[] }', () => {
    const result = translateLineResponse(fixture, '4', '2026-05-19');
    expect(result.line).not.toBeNull();
    expect(result.line!.id).toBe('1:4');
    expect(result.line!.shortName).toBe('4');
    expect(result.line!.longName).toBe('Línea 4 — Real de San Carlos');
  });

  it('R-06 returns one shape per direction (encoded polyline from patternGeometry)', () => {
    const result = translateLineResponse(fixture, '4', '2026-05-19');
    expect(result.shape.length).toBe(2);
    expect(result.shape[0].points).toBe('_p~iF~ps|U_ulLnnqC');
  });

  it('R-06 directions carry stops[] and scheduledDepartures[]', () => {
    const result = translateLineResponse(fixture, '4', '2026-05-19');
    expect(result.directions.length).toBe(2);
    expect(result.directions[0].headsign).toBe('Centro');
    expect(result.directions[0].stops.length).toBe(2);
    expect(result.directions[0].scheduledDepartures.length).toBe(2);
    expect(result.directions[0].scheduledDepartures[0]).toMatch(/^\d{2}:\d{2}$/);
  });

  it('R-06 surfaces meta.date in Montevideo TZ', () => {
    const result = translateLineResponse(fixture, '4', '2026-05-19');
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

  it('R-06 skips patterns without patternGeometry when building shape', () => {
    const noGeom = {
      data: {
        routes: [
          {
            gtfsId: '1:4',
            shortName: '4',
            longName: 'L4',
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
    const result = translateLineResponse(noGeom, '4', '2026-05-19');
    expect(result.shape).toEqual([]);
    expect(result.directions.length).toBe(1);
  });
});
