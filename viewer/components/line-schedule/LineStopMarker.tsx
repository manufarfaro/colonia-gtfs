'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { getLineColor } from '@/lib/colors/lines';
import { stopMarkerIconUrl } from '@/lib/icons/marker-icons';

/**
 * Stop dot for the line-schedule layer. Smaller than the OD endpoint
 * marker (`StopMarker`) — line routes show 20-30+ stops along the path,
 * so each one is a subtle colored dot, not a Google drop-pin. Click
 * still dispatches to the parent (push stop-info mode). Runtime-only —
 * coverage excluded.
 */
/* v8 ignore start */
export function LineStopMarker({
  stopId,
  name,
  shortName,
  lat,
  lng,
  onClick,
}: {
  stopId: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  onClick?: (stopId: string) => void;
}): React.ReactElement | null {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: name,
      icon: {
        url: stopMarkerIconUrl(getLineColor(shortName)),
        scaledSize: new google.maps.Size(14, 14),
        anchor: new google.maps.Point(7, 7),
      },
      zIndex: 1,
    });
    const listener = onClick ? marker.addListener('click', () => onClick(stopId)) : null;
    return () => {
      listener?.remove();
      marker.setMap(null);
    };
  }, [map, stopId, name, shortName, lat, lng, onClick]);
  return null;
}
/* v8 ignore stop */
