import { describe, expect, it } from 'vitest';
import { busMarkerIconUrl, stopMarkerIconUrl } from './marker-icons';

describe('marker icon data URLs', () => {
  it('busMarkerIconUrl produces a data:image/svg+xml URL with the given color baked in', () => {
    const url = busMarkerIconUrl('#0077b5');
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('#0077b5');
  });

  it('stopMarkerIconUrl produces a data:image/svg+xml URL with the given stroke color', () => {
    const url = stopMarkerIconUrl('#ef4444');
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('#ef4444');
  });
});
