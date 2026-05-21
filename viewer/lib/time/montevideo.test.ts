import { afterEach, describe, expect, it, vi } from 'vitest';
import { nowInMontevideoPlusOneMinute } from './montevideo';

afterEach(() => {
  vi.useRealTimers();
});

describe('nowInMontevideoPlusOneMinute', () => {
  it('R-07 returns YYYY-MM-DD + HH:MM in Montevideo TZ, rounded to next minute', () => {
    // 2026-05-20 14:30:25 UTC = 11:30:25 in Montevideo (UTC-3, no DST).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T14:30:25Z'));
    const { date, time } = nowInMontevideoPlusOneMinute();
    expect(date).toBe('2026-05-20');
    expect(time).toBe('11:31');
  });

  it('R-07 rounds up across the hour boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T14:59:10Z'));
    const { time } = nowInMontevideoPlusOneMinute();
    expect(time).toBe('12:00');
  });

  it('R-07 rolls the date when adding the minute crosses midnight Montevideo', () => {
    // 2026-05-21 02:59:30 UTC = 23:59:30 on 2026-05-20 in Montevideo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T02:59:30Z'));
    const { date, time } = nowInMontevideoPlusOneMinute();
    expect(date).toBe('2026-05-21');
    expect(time).toBe('00:00');
  });
});
