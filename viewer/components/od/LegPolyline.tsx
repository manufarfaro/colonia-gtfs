'use client';

import { useEffect, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { decodePolyline, type LatLng } from '@/lib/google-maps/polyline';
import { getLineColor, WALK_COLOR } from '@/lib/colors/lines';
import type { RestLeg } from '@/lib/otp/translate-plan';

/**
 * A single Polyline drawn for one leg of the itinerary. We do not use
 * `@vis.gl/react-google-maps`'s `<Polyline>` (it only exists in the docs
 * as an example, not as a stable export); instead we drop down to the
 * raw `google.maps.Polyline` class with the imperative map hook from the
 * wrapper. Runtime-only — excluded from coverage (tests stub this
 * component entirely; see MapCanvas.test.tsx).
 */
/* v8 ignore start */
export function LegPolyline({ leg }: { leg: RestLeg }): React.ReactElement | null {
  const map = useMap();
  const path: LatLng[] = useMemo(
    () => (leg.legGeometry ? decodePolyline(leg.legGeometry.points) : []),
    [leg.legGeometry],
  );

  useEffect(() => {
    if (!map || path.length === 0) return;
    const polyline = new google.maps.Polyline({
      path: path.map((p) => new google.maps.LatLng(p.lat, p.lng)),
      strokeColor: leg.mode === 'BUS' ? getLineColor(leg.route?.shortName ?? '') : WALK_COLOR,
      strokeOpacity: leg.mode === 'BUS' ? 1 : 0,
      strokeWeight: leg.mode === 'BUS' ? 5 : 0,
      icons:
        leg.mode === 'WALK'
          ? [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.6, scale: 4 },
                offset: '0',
                repeat: '10px',
              },
            ]
          : undefined,
      map,
    });
    return () => {
      polyline.setMap(null);
    };
  }, [map, path, leg.mode, leg.route?.shortName]);

  return null;
}

export function StopMarker({
  stopId,
  lat,
  lng,
}: {
  stopId: string;
  lat: number;
  lng: number;
}): React.ReactElement | null {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({ position: { lat, lng }, map, title: stopId });
    return () => {
      marker.setMap(null);
    };
  }, [map, stopId, lat, lng]);
  return null;
}
/* v8 ignore stop */
