import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closestDepartureIndex, minutesSinceMidnightMVD, nextArrivalAtStop } from './schedule';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('minutesSinceMidnightMVD', () => {
  it('returns minutes from midnight in Montevideo TZ', () => {
    // 2026-05-21 18:30:00 UTC → 15:30 Montevideo
    vi.setSystemTime(new Date('2026-05-21T18:30:00Z'));
    expect(minutesSinceMidnightMVD(new Date())).toBe(15 * 60 + 30);
  });
});

describe('closestDepartureIndex', () => {
  it('returns -1 on an empty list', () => {
    expect(closestDepartureIndex([], 600)).toBe(-1);
  });

  it('picks the departure with the smallest absolute distance to now', () => {
    const list = ['08:00', '09:00', '10:00', '11:00'];
    // now = 09:20 → closest is 09:00 (idx 1, distance 20 vs 40 to 10:00)
    expect(closestDepartureIndex(list, 9 * 60 + 20)).toBe(1);
    // now = 09:40 → closest is 10:00 (idx 2)
    expect(closestDepartureIndex(list, 9 * 60 + 40)).toBe(2);
  });

  it('ignores malformed entries gracefully', () => {
    const list = ['not-a-time', '07:00', 'also-bad'];
    expect(closestDepartureIndex(list, 7 * 60 + 5)).toBe(1);
  });
});

describe('nextArrivalAtStop', () => {
  it('adds the offset and returns the first arrival ≥ now', () => {
    const list = ['08:00', '08:30', '09:00'];
    // offset 6 min → arrivals at 08:06, 08:36, 09:06
    // now = 08:20 → next is 08:36
    expect(nextArrivalAtStop(list, 360, 8 * 60 + 20)).toBe('08:36');
  });

  it('returns null when all arrivals are in the past', () => {
    const list = ['07:00', '07:30'];
    expect(nextArrivalAtStop(list, 0, 23 * 60)).toBeNull();
  });

  it('wraps the hour correctly when minutes overflow', () => {
    const list = ['09:55'];
    // 9:55 + 10 min offset = 10:05
    expect(nextArrivalAtStop(list, 600, 9 * 60)).toBe('10:05');
  });

  it('skips malformed departures', () => {
    const list = ['bad', '10:00'];
    expect(nextArrivalAtStop(list, 0, 9 * 60)).toBe('10:00');
  });
});
