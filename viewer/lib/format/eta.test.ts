import { describe, expect, it } from 'vitest';
import { formatEta } from './eta';

describe('formatEta', () => {
  it('R-03 returns "Ahora" when the arrival is at or before now (within tolerance)', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T14:30:00Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'now' });
  });

  it('R-03 returns "now" when arrival is up to 30s in the past', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T14:29:45Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'now' });
  });

  it('R-03 returns minutes when arrival is within 30 minutes', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T14:34:00Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'minutes', minutes: 4 });
  });

  it('R-03 rounds up to the next minute', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T14:30:30Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'minutes', minutes: 1 });
  });

  it('R-03 returns "passed" when arrival is more than 60s in the past', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T14:25:00Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'passed', minutes: 5 });
  });

  it('R-03 returns absolute HH:MM in Montevideo TZ beyond 30 minutes', () => {
    const now = new Date('2026-05-20T14:30:00Z'); // 11:30 in Montevideo (UTC-3).
    const arrival = new Date('2026-05-20T15:10:00Z'); // 12:10 in Montevideo, 40 min after now.
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'absolute', time: '12:10' });
  });

  it('R-03 uses Montevideo TZ for the absolute form (no DST in Uruguay)', () => {
    const now = new Date('2026-05-20T14:30:00Z'); // 11:30 in Montevideo.
    const arrival = new Date('2026-05-20T16:30:00Z'); // 13:30 in Montevideo.
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'absolute', time: '13:30' });
  });

  it('R-03 at exactly 30 minutes still uses the minutes form', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T15:00:00Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'minutes', minutes: 30 });
  });

  it('R-03 at 31 minutes switches to absolute form', () => {
    const now = new Date('2026-05-20T14:30:00Z');
    const arrival = new Date('2026-05-20T15:01:00Z');
    expect(formatEta(arrival.toISOString(), now)).toEqual({ kind: 'absolute', time: '12:01' });
  });
});
