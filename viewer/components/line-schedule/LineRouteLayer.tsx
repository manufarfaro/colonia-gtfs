'use client';

import { useEffect, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { decodePolyline } from '@/lib/google-maps/polyline';
import { getLineColor } from '@/lib/colors/lines';
import type { RestLineResponse } from '@/lib/otp/translate-line';
import type { VehiclesResponse } from './useVehiclesQuery';
import { LineStopMarker } from './LineStopMarker';
import { VehicleMarker } from './VehicleMarker';

/**
 * Layer rendering for the line-schedule mode. Pints the union of:
 *  - one polyline per direction (color from the palette)
 *  - one stop marker per unique stop across directions
 *  - one vehicle marker per live vehicle (rendered separately so they
 *    re-mount cleanly on the 15s poll)
 *
 * The Polylines use imperative `google.maps.Polyline` (same pattern as
 * `LegPolyline`). Runtime-only — excluded from coverage. The wiring is
 * tested via the MapCanvas stubbed test.
 */
/* v8 ignore start */
export function LineRouteLayer({
  data,
  vehicles,
  activeDirectionId,
  onStopClick,
}: {
  data: RestLineResponse;
  vehicles: VehiclesResponse['vehicles'];
  activeDirectionId: number;
  onStopClick?: (stopId: string) => void;
}): React.ReactElement {
  const map = useMap();
  const shortName = data.line?.shortName ?? '';
  const polylines = useMemo(
    () =>
      data.shape
        .filter((s) => s.directionId === activeDirectionId)
        .map((s) => ({
          directionId: s.directionId,
          path: decodePolyline(s.points).map((p) => new google.maps.LatLng(p.lat, p.lng)),
        })),
    [data.shape, activeDirectionId],
  );

  useEffect(() => {
    if (!map) return;
    const color = getLineColor(shortName);
    const instances = polylines.map(
      (p) =>
        new google.maps.Polyline({
          path: p.path,
          strokeColor: color,
          strokeOpacity: 0.95,
          strokeWeight: 5,
          map,
          zIndex: 3,
        }),
    );
    return () => {
      instances.forEach((pl) => pl.setMap(null));
    };
  }, [map, polylines, shortName]);

  // Stops + vehicles are React-composable primitives (already cover their
  // own runtime exclusion).
  const activeStops = useMemo(() => {
    const dir = data.directions.find((d) => d.directionId === activeDirectionId);
    if (!dir) return [];
    return dir.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lon }));
  }, [data.directions, activeDirectionId]);

  return (
    <>
      {activeStops.map((stop) => (
        <LineStopMarker
          key={stop.id}
          stopId={stop.id}
          name={stop.name}
          shortName={shortName}
          lat={stop.lat}
          lng={stop.lng}
          onClick={onStopClick}
        />
      ))}
      {vehicles.map((v) => (
        <VehicleMarker
          key={v.id}
          shortName={shortName}
          label={v.label}
          lat={v.lat}
          lng={v.lon}
          bearing={v.bearing}
        />
      ))}
    </>
  );
}
/* v8 ignore stop */
