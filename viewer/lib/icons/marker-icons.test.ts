import { describe, expect, it } from 'vitest';
import {
  busMarkerIconUrl,
  destinationMarkerIconUrl,
  originMarkerIconUrl,
  stopMarkerIconUrl,
} from './marker-icons';

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

  it('originMarkerIconUrl bakes the given fill color into the Lucide circle glyph', () => {
    const url = originMarkerIconUrl('#0084fc');
    const decoded = decodeURIComponent(url);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decoded).toContain('#0084fc');
    expect(decoded).toContain('<circle');
  });

  it('destinationMarkerIconUrl bakes the given fill color into the Lucide map-pin glyph', () => {
    const url = destinationMarkerIconUrl('#dc2626');
    const decoded = decodeURIComponent(url);
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decoded).toContain('#dc2626');
    // Lucide map-pin uses an outer teardrop path + an inner circle.
    expect(decoded).toContain('<path');
    expect(decoded).toContain('<circle');
  });
});
