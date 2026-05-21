'use client';

import { Map } from '@vis.gl/react-google-maps';
import { boundsOfPaths } from '@/lib/geo/bbox';
import { decodePolyline, type LatLng } from '@/lib/google-maps/polyline';
import type { RestItinerary } from '@/lib/otp/translate-plan';
import type { RestLineResponse } from '@/lib/otp/translate-line';
import { LegPolyline, StopMarker } from './LegPolyline';
import { VehicleMarker } from '@/components/line-schedule/VehicleMarker';
import type { VehiclesResponse } from '@/components/line-schedule/useVehiclesQuery';
import { LineRouteLayer } from '@/components/line-schedule/LineRouteLayer';
import { LineLegend } from '@/components/line-schedule/LineLegend';

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

function fitBoundsFromLine(line: RestLineResponse): MapBounds | undefined {
  const paths: LatLng[][] = line.shape
    .map((s) => decodePolyline(s.points))
    .filter((p) => p.length > 0);
  const b = boundsOfPaths(paths);
  if (!b) return undefined;
  return { south: b.sw.lat, west: b.sw.lng, north: b.ne.lat, east: b.ne.lng };
}

export interface LineLayerProps {
  data: RestLineResponse;
  vehicles: VehiclesResponse['vehicles'];
  activeDirectionId: number;
  onActiveDirectionChange?: (directionId: number) => void;
}

export function MapCanvas({
  itinerary,
  lineLayer,
  onStopClick,
}: {
  itinerary: RestItinerary | null;
  /** When provided (line-schedule mode), the line layer wins over the OD itinerary. */
  lineLayer?: LineLayerProps;
  /**
   * Optional click handler — when provided, every `StopMarker` rendered
   * by the canvas dispatches `onStopClick(stopId)` on tap. The OD shell
   * wires this to the mode hook's `setMode({type:'stop-info', stopId})`.
   */
  onStopClick?: (stopId: string) => void;
}): React.ReactElement {
  const bounds = lineLayer
    ? fitBoundsFromLine(lineLayer.data)
    : itinerary
      ? fitBoundsFromItinerary(itinerary)
      : undefined;

  return (
    <div className="relative h-full w-full">
      {lineLayer && (
        <LineLegend
          data={lineLayer.data}
          activeDirectionId={lineLayer.activeDirectionId}
          onActiveDirectionChange={lineLayer.onActiveDirectionChange}
        />
      )}
      <Map
        defaultCenter={COLONIA_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        defaultBounds={bounds}
        mapId="colonia-od"
        disableDefaultUI={false}
      >
      {lineLayer ? (
        <LineRouteLayer
          data={lineLayer.data}
          vehicles={lineLayer.vehicles}
          activeDirectionId={lineLayer.activeDirectionId}
          onStopClick={onStopClick}
        />
      ) : (
        <>
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
        </>
      )}
      </Map>
    </div>
  );
}

// Re-export type usable from VehicleMarker module (avoid circular).
export type { VehicleMarker };
