import { describe, expect, it } from 'vitest';
import { getLineColor, WALK_COLOR } from './lines';

describe('getLineColor', () => {
  it('R-04 returns the design palette for v0 Sol Antigua lines', () => {
    expect(getLineColor('3')).toBe('#ef4444');
    expect(getLineColor('4')).toBe('#3b82f6');
    expect(getLineColor('5')).toBe('#22c55e');
    expect(getLineColor('8')).toBe('#f59e0b');
  });

  it('R-04 falls back to indigo for unknown short names', () => {
    expect(getLineColor('99')).toBe('#6366f1');
    expect(getLineColor('')).toBe('#6366f1');
  });
});

describe('WALK_COLOR', () => {
  it('R-04 exports the design walk color', () => {
    expect(WALK_COLOR).toBe('#6b7280');
  });
});
