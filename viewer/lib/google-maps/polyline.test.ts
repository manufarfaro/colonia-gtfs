import { describe, expect, it } from 'vitest';
import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
  // Canonical Google example from the algorithm docs:
  //   _p~iF~ps|U_ulLnnqC_mqNvxq`@ →
  //   [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
  it('R-04 decodes the canonical Google example', () => {
    const path = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(path).toHaveLength(3);
    const expected = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    for (let i = 0; i < expected.length; i++) {
      expect(path[i].lat).toBeCloseTo(expected[i].lat, 5);
      expect(path[i].lng).toBeCloseTo(expected[i].lng, 5);
    }
  });

  it('R-04 returns an empty array for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('R-04 handles a negative-dlat / positive-dlng point (covers the inverse sign branches)', () => {
    // Handcrafted single-point polyline:
    //   "R" = char code 82, minus 63 = 19 = 10011 → result=19, sign-bit set
    //         → dlat = ~(19>>1) = ~9 = -10 (exercises the truthy branch of
    //         the dlat ternary).
    //   "S" = char code 83, minus 63 = 20 = 10100 → result=20, sign-bit clear
    //         → dlng = 20>>1 = 10 (exercises the falsy branch of the dlng
    //         ternary; the canonical example only exercises the truthy side).
    const path = decodePolyline('RS');
    expect(path).toHaveLength(1);
    expect(path[0].lat).toBeCloseTo(-0.0001, 5);
    expect(path[0].lng).toBeCloseTo(0.0001, 5);
  });
});
