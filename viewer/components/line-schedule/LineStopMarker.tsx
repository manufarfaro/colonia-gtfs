'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { getLineColor } from '@/lib/colors/lines';
import { stopMarkerIconUrl } from '@/lib/icons/marker-icons';

/**
 * Stop dot for the line-schedule layer. Smaller than the OD endpoint
 * marker — line routes show 20-30+ stops along the path, so each one
 * is a subtle colored dot. When `selected` is true the dot grows to
 * ~22px and the marker pans into view, mirroring the sidebar's
 * highlighted row state. Click still dispatches `onClick(stopId)` so
 * the sidebar selection mirrors map taps.
 *
 * Runtime-only — coverage excluded via vitest.config.
 */
/* v8 ignore start */
export function LineStopMarker({
  stopId,
  name,
  shortName,
  lat,
  lng,
  selected = false,
  onClick,
}: {
  stopId: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  selected?: boolean;
  onClick?: (stopId: string) => void;
}): React.ReactElement | null {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const lineColor = getLineColor(shortName);
    const size = selected ? 22 : 14;
    const anchor = size / 2;
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: name,
      icon: {
        url: stopMarkerIconUrl(lineColor),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(anchor, anchor),
      },
      zIndex: selected ? 8 : 1,
    });
    if (selected) map.panTo({ lat, lng });
    const listener = onClick ? marker.addListener('click', () => onClick(stopId)) : null;
    return () => {
      listener?.remove();
      marker.setMap(null);
    };
  }, [map, stopId, name, shortName, lat, lng, selected, onClick]);
  return null;
}
/* v8 ignore stop */
