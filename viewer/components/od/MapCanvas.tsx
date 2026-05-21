'use client';

import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { boundsOfPaths } from '@/lib/geo/bbox';
import { decodePolyline } from '@/lib/google-maps/polyline';
import type { RestItinerary } from '@/lib/otp/translate-plan';
import { LegPolyline, StopMarker } from './LegPolyline';

const COLONIA_CENTER = { lat: -34.467, lng: -57.84 };
const DEFAULT_ZOOM = 15;

interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

function fitBoundsFromItinerary(itinerary: RestItinerary): MapBounds | undefined {
  const paths = itinerary.legs
    .filter((leg) => leg.legGeometry !== null)
    .map((leg) => decodePolyline(leg.legGeometry!.points));
  const b = boundsOfPaths(paths);
  if (!b) return undefined;
  return { south: b.sw.lat, west: b.sw.lng, north: b.ne.lat, east: b.ne.lng };
}

export function MapCanvas({
  apiKey,
  itinerary,
  onStopClick,
}: {
  apiKey: string;
  itinerary: RestItinerary | null;
  /**
   * Optional click handler — when provided, every `StopMarker` rendered
   * by the canvas dispatches `onStopClick(stopId)` on tap. The OD shell
   * wires this to the mode hook's `setMode({type:'stop-info', stopId})`.
   */
  onStopClick?: (stopId: string) => void;
}): React.ReactElement {
  const bounds = itinerary ? fitBoundsFromItinerary(itinerary) : undefined;

  return (
    <APIProvider apiKey={apiKey} libraries={['places', 'geometry']}>
      <Map
        defaultCenter={COLONIA_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        defaultBounds={bounds}
        mapId="colonia-od"
        disableDefaultUI={false}
      >
        {itinerary?.legs.map((leg, i) => (
          <LegPolyline key={`leg-${i}`} leg={leg} />
        ))}
        {itinerary?.legs
          .filter((leg) => leg.mode === 'BUS')
          .flatMap((leg) =>
            [leg.from, leg.to]
              .filter((end) => end.stopId !== null)
              .map((end) => (
                <StopMarker
                  key={`marker-${end.stopId}`}
                  stopId={end.stopId!}
                  lat={end.lat}
                  lng={end.lon}
                  onClick={onStopClick}
                />
              )),
          )}
      </Map>
    </APIProvider>
  );
}
