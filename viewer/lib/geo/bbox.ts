export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  sw: LatLng;
  ne: LatLng;
}

export function boundsOfPaths(paths: readonly (readonly LatLng[])[]): LatLngBounds | null {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  let seenAny = false;
  for (const path of paths) {
    for (const p of path) {
      seenAny = true;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng > maxLng) maxLng = p.lng;
    }
  }
  if (!seenAny) return null;
  return {
    sw: { lat: minLat, lng: minLng },
    ne: { lat: maxLat, lng: maxLng },
  };
}
