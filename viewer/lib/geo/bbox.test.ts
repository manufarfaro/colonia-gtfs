import { describe, expect, it } from 'vitest';
import { boundsOfPaths } from './bbox';

describe('boundsOfPaths', () => {
  it('R-04 returns null when given no paths', () => {
    expect(boundsOfPaths([])).toBeNull();
  });

  it('R-04 returns null when every path is empty', () => {
    expect(boundsOfPaths([[], []])).toBeNull();
  });

  it('R-04 returns the lat/lon extremes across all paths', () => {
    const paths = [
      [
        { lat: -34.5, lng: -57.85 },
        { lat: -34.4, lng: -57.82 },
      ],
      [
        { lat: -34.45, lng: -57.87 },
        { lat: -34.46, lng: -57.81 },
      ],
    ];
    expect(boundsOfPaths(paths)).toEqual({
      sw: { lat: -34.5, lng: -57.87 },
      ne: { lat: -34.4, lng: -57.81 },
    });
  });

  it('R-04 handles a single-point path (sw === ne)', () => {
    const paths = [[{ lat: -34.47, lng: -57.84 }]];
    expect(boundsOfPaths(paths)).toEqual({
      sw: { lat: -34.47, lng: -57.84 },
      ne: { lat: -34.47, lng: -57.84 },
    });
  });
});
