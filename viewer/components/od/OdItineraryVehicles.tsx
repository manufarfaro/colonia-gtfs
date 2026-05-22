'use client';

import { VehicleMarker } from '@/components/line-schedule/VehicleMarker';
import { useVehiclesQuery } from '@/components/line-schedule/useVehiclesQuery';

/**
 * Renders the real-time vehicle markers for ONE bus line + direction
 * referenced by the currently-selected OD itinerary. Mounted from
 * `MapCanvas` once per unique (shortName, directionId) pair in the
 * itinerary's bus legs. When the leg includes a `directionId`, only
 * vehicles doing THAT direction render — line 4 is a loop and the
 * outbound bus is on the opposite side of the city from the inbound
 * one. Falls back to "any direction" when the leg's directionId is
 * unknown (OTP omitted it). Pure runtime component — coverage
 * excluded.
 */
/* v8 ignore start */
export function OdItineraryVehicles({
  shortName,
  directionId,
  headsign,
}: {
  shortName: string;
  directionId: number | null;
  headsign: string | null;
}): React.ReactElement | null {
  const v = useVehiclesQuery(shortName);
  if (v.state !== 'success') return null;
  const filtered =
    directionId !== null
      ? v.data.vehicles.filter((vh) => vh.directionId === directionId)
      : v.data.vehicles;
  return (
    <>
      {filtered.map((vh) => (
        <VehicleMarker
          key={vh.id}
          shortName={shortName}
          label={vh.label}
          headsign={headsign}
          lat={vh.lat}
          lng={vh.lon}
          bearing={vh.bearing}
          timestamp={vh.timestamp}
        />
      ))}
    </>
  );
}
/* v8 ignore stop */
