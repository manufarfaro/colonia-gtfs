import { describe, expect, it } from 'vitest';
import fixture from '../../test/fixtures/otp/arrivals-response.json';
import { translateArrivalsResponse } from './translate-arrivals';

describe('translateArrivalsResponse', () => {
  it('R-05 maps stop metadata into REST shape', () => {
    const out = translateArrivalsResponse(fixture, '2026-06-02');
    expect(out.stop).toEqual({
      id: 'sol-antigua:3',
      name: 'INT SUAREZ',
      lat: -34.470578,
      lon: -57.847103,
    });
  });

  it('R-05 flattens each stoptime into an arrival with isRealtime + delaySeconds', () => {
    const out = translateArrivalsResponse(fixture, '2026-06-02');
    expect(out.arrivals).toHaveLength(2);
    expect(out.arrivals[0].lineShortName).toBe('4');
    expect(out.arrivals[0].headsign).toBe('Centro');
    expect(out.arrivals[0].isRealtime).toBe(true);
    expect(out.arrivals[0].delaySeconds).toBe(30);
    expect(out.arrivals[1].isRealtime).toBe(false);
    expect(out.arrivals[1].delaySeconds).toBe(0);
  });

  it('R-05 reports realtime_available=true when at least one entry is realtime', () => {
    const out = translateArrivalsResponse(fixture, '2026-06-02');
    expect(out.meta.realtime_available).toBe(true);
  });

  it('R-05 reports realtime_available=false when no entry is realtime', () => {
    const noRt = JSON.parse(JSON.stringify(fixture));
    for (const p of noRt.data.stop.stoptimesForServiceDate) {
      for (const st of p.stoptimes) {
        st.realtime = false;
        st.realtimeState = 'SCHEDULED';
      }
    }
    const out = translateArrivalsResponse(noRt, '2026-06-02');
    expect(out.meta.realtime_available).toBe(false);
  });

  it('R-05 returns null stop when OTP has no stop matching the id', () => {
    const out = translateArrivalsResponse({ data: { stop: null } }, '2026-06-02');
    expect(out.stop).toBeNull();
    expect(out.arrivals).toEqual([]);
  });

  it('R-05 defaults to empty arrivals when the stop has no stoptimesForServiceDate field', () => {
    const out = translateArrivalsResponse(
      {
        data: {
          stop: {
            gtfsId: 'sol-antigua:3',
            name: 'X',
            lat: 0,
            lon: 0,
            // stoptimesForServiceDate intentionally omitted to exercise the
            // `?? []` default branch.
          },
        },
      },
      '2026-06-02',
    );
    expect(out.stop).not.toBeNull();
    expect(out.arrivals).toEqual([]);
    expect(out.meta.realtime_available).toBe(false);
  });
});
