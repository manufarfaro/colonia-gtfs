import { describe, expect, it } from 'vitest';
import fixture from '@/test/fixtures/otp/line-response.json';
import { translateLineResponse } from './translate-line';

describe('translateLineResponse', () => {
  it('R-06 maps OTP route to { line, shape, directions[] }', () => {
    const result = translateLineResponse(fixture, '2026-05-19');
    expect(result.line).not.toBeNull();
    expect(result.line!.id).toBe('sol-antigua:4');
    expect(result.line!.shortName).toBe('4');
    expect(result.line!.longName).toBe('Línea 4 — Real de San Carlos');
  });

  it('R-06 returns one shape per direction (encoded polyline)', () => {
    const result = translateLineResponse(fixture, '2026-05-19');
    expect(result.shape.length).toBe(2);
    expect(result.shape[0].points).toBe('_p~iF~ps|U_ulLnnqC');
  });

  it('R-06 directions carry stops[] and scheduledDepartures[]', () => {
    const result = translateLineResponse(fixture, '2026-05-19');
    expect(result.directions.length).toBe(2);
    expect(result.directions[0].headsign).toBe('Centro');
    expect(result.directions[0].stops.length).toBe(2);
    expect(result.directions[0].scheduledDepartures.length).toBe(2);
    expect(result.directions[0].scheduledDepartures[0]).toMatch(/^\d{2}:\d{2}$/);
  });

  it('R-06 surfaces meta.date in Montevideo TZ', () => {
    const result = translateLineResponse(fixture, '2026-05-19');
    expect(result.meta.date).toBe('2026-05-19');
  });

  it('R-06 returns line: null when OTP cannot resolve route', () => {
    const empty = { data: { route: null } };
    const result = translateLineResponse(empty, '2026-05-19');
    expect(result.line).toBeNull();
    expect(result.directions).toEqual([]);
    expect(result.shape).toEqual([]);
  });
});
