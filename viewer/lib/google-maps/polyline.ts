// Pure-JS decoder for the Google Encoded Polyline Algorithm Format
// (https://developers.google.com/maps/documentation/utilities/polylinealgorithm).
// We don't call `google.maps.geometry.encoding.decodePath` because that
// requires the live browser globals; a self-contained decoder lets us
// test the full polyline-to-map render path under vitest without
// pulling Google Maps into the test environment.

export interface LatLng {
  lat: number;
  lng: number;
}

export function decodePolyline(encoded: string): LatLng[] {
  const path: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    path.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return path;
}
