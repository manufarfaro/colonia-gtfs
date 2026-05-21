import { describe, expect, it } from 'vitest';
import { COLONIA_BBOX, PLACES_COMPONENT_RESTRICTIONS } from './places-options';

describe('places-options', () => {
  it('R-03 COLONIA_BBOX matches the design SW/NE corners', () => {
    expect(COLONIA_BBOX.sw).toEqual({ lat: -34.49, lng: -57.87 });
    expect(COLONIA_BBOX.ne).toEqual({ lat: -34.435, lng: -57.8 });
  });

  it('R-03 restricts the country to Uruguay', () => {
    expect(PLACES_COMPONENT_RESTRICTIONS).toEqual({ country: 'uy' });
  });
});
