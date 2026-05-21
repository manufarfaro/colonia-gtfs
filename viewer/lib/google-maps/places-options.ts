// Static config for the Places Autocomplete service used by the OD mode.
// Pinned at the v0 design (D-04): a bounding box that covers Colonia urbano
// + Real de San Carlos + Buquebus + the eastern barrios, plus a UY-only
// component restriction so suggestions don't bleed into Buenos Aires.

export const COLONIA_BBOX = {
  sw: { lat: -34.49, lng: -57.87 },
  ne: { lat: -34.435, lng: -57.8 },
} as const;

export const PLACES_COMPONENT_RESTRICTIONS = { country: 'uy' } as const;
