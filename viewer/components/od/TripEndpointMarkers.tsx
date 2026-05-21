'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { destinationMarkerIconUrl, originMarkerIconUrl } from '@/lib/icons/marker-icons';
import type { RestItinerary } from '@/lib/otp/translate-plan';

const ORIGIN_COLOR = '#0084fc';
const DESTINATION_COLOR = '#dc2626';

/**
 * Origin + destination markers for the currently-selected OD
 * itinerary. Mounted by `MapCanvas` once per render. Uses the same
 * Lucide-style icons (filled `Circle` for origin, `MapPin` for
 * destination) the sidebar OD inputs show — so the user has a visual
 * link between the input groups and the map. Runtime-only; coverage
 * excluded.
 */
/* v8 ignore start */
export function TripEndpointMarkers({
  itinerary,
}: {
  itinerary: RestItinerary;
}): React.ReactElement | null {
  const map = useMap();
  const first = itinerary.legs[0]?.from;
  const last = itinerary.legs[itinerary.legs.length - 1]?.to;

  useEffect(() => {
    if (!map || !first || !last) return;
    const origin = new google.maps.Marker({
      position: { lat: first.lat, lng: first.lon },
      map,
      title: first.name,
      icon: {
        url: originMarkerIconUrl(ORIGIN_COLOR),
        scaledSize: new google.maps.Size(24, 24),
        anchor: new google.maps.Point(12, 12),
      },
      zIndex: 9,
    });
    const destination = new google.maps.Marker({
      position: { lat: last.lat, lng: last.lon },
      map,
      title: last.name,
      icon: {
        url: destinationMarkerIconUrl(DESTINATION_COLOR),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 30),
      },
      zIndex: 9,
    });
    return () => {
      origin.setMap(null);
      destination.setMap(null);
    };
  }, [map, first, last]);

  return null;
}
/* v8 ignore stop */
