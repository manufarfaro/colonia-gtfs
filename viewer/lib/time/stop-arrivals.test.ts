import { describe, expect, it } from 'vitest';
import { computeStopArrivals } from './stop-arrivals';

describe('computeStopArrivals', () => {
  it('returns empty when departures are empty', () => {
    expect(computeStopArrivals([], 0, 600)).toEqual([]);
  });

  it('tags arrivals before now as past + the first future arrival as next', () => {
    const out = computeStopArrivals(['07:00', '07:30', '08:00'], 0, 7 * 60 + 15);
    expect(out.map((a) => a.status)).toEqual(['past', 'next', 'future']);
    expect(out[1].arrivalTime).toBe('07:30');
    expect(out[1].diffMinutes).toBe(15);
  });

  it('adds the offset to the departure time before classifying', () => {
    // offset 6 min → arrivals at 07:06, 07:36, 08:06
    // now = 07:20 → past 07:06, next 07:36, future 08:06
    const out = computeStopArrivals(['07:00', '07:30', '08:00'], 360, 7 * 60 + 20);
    expect(out.map((a) => a.arrivalTime)).toEqual(['07:06', '07:36', '08:06']);
    expect(out.map((a) => a.status)).toEqual(['past', 'next', 'future']);
  });

  it('marks every entry as past when all arrivals are before now', () => {
    const out = computeStopArrivals(['07:00', '07:30'], 0, 22 * 60);
    expect(out.every((a) => a.status === 'past')).toBe(true);
  });

  it('marks the first entry as next when all arrivals are after now', () => {
    const out = computeStopArrivals(['09:00', '09:30'], 0, 6 * 60);
    expect(out[0].status).toBe('next');
    expect(out[1].status).toBe('future');
  });

  it('sorts arrivals chronologically before tagging', () => {
    const out = computeStopArrivals(['08:00', '07:00'], 0, 6 * 60);
    expect(out.map((a) => a.arrivalTime)).toEqual(['07:00', '08:00']);
  });

  it('skips malformed entries', () => {
    const out = computeStopArrivals(['bad', '07:00'], 0, 6 * 60);
    expect(out).toHaveLength(1);
    expect(out[0].arrivalTime).toBe('07:00');
  });

  it('wraps formatted times that overflow past midnight', () => {
    const out = computeStopArrivals(['23:55'], 600, 22 * 60);
    expect(out[0].arrivalTime).toBe('00:05');
  });
});
