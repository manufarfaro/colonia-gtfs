'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { getLineColor } from '@/lib/colors/lines';

/**
 * Live vehicle marker. Renders as a `google.maps.Marker` with the
 * line color + the bearing (when available) as a tooltip. Runtime-only
 * — testable contract is the prop wiring, which is covered by the
 * MapCanvas test that stubs this component entirely.
 */
/* v8 ignore start */
export function VehicleMarker({
  shortName,
  label,
  lat,
  lng,
  bearing,
}: {
  shortName: string;
  label: string | null;
  lat: number;
  lng: number;
  bearing: number | null;
}): React.ReactElement | null {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: bearing !== null ? `${label ?? shortName} · ${bearing}°` : (label ?? shortName),
      icon: {
        // Stylized bus silhouette: rectangular body with two wheel
        // bumps on the bottom edge. Tinted to the line color.
        path: 'M -10,-7 L 10,-7 L 10,4 L 7,4 L 7,7 L 4,7 L 4,4 L -4,4 L -4,7 L -7,7 L -7,4 L -10,4 Z',
        scale: 1.4,
        fillColor: getLineColor(shortName),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 1.5,
        anchor: new google.maps.Point(0, 0),
      },
      zIndex: 10,
    });
    return () => {
      marker.setMap(null);
    };
  }, [map, shortName, label, lat, lng, bearing]);
  return null;
}
/* v8 ignore stop */
