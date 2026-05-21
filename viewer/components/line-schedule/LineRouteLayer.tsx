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
  onStopClick,
}: {
  data: RestLineResponse;
  vehicles: VehiclesResponse['vehicles'];
  onStopClick?: (stopId: string) => void;
}): React.ReactElement {
  const map = useMap();
  const shortName = data.line?.shortName ?? '';
  const polylines = useMemo(
    () =>
      data.shape.map((s) => ({
        directionId: s.directionId,
        path: decodePolyline(s.points).map((p) => new google.maps.LatLng(p.lat, p.lng)),
      })),
    [data.shape],
  );

  useEffect(() => {
    if (!map) return;
    const instances = polylines.map((p) =>
      new google.maps.Polyline({
        path: p.path,
        strokeColor: getLineColor(shortName),
        strokeOpacity: 1,
        strokeWeight: 5,
        map,
      }),
    );
    return () => {
      instances.forEach((pl) => pl.setMap(null));
    };
  }, [map, polylines, shortName]);

  // Stops + vehicles are React-composable primitives (already cover their
  // own runtime exclusion).
  const uniqueStops = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ id: string; name: string; lat: number; lng: number }> = [];
    for (const dir of data.directions) {
      for (const stop of dir.stops) {
        if (seen.has(stop.id)) continue;
        seen.add(stop.id);
        out.push({ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lon });
      }
    }
    return out;
  }, [data.directions]);

  return (
    <>
      {uniqueStops.map((stop) => (
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
