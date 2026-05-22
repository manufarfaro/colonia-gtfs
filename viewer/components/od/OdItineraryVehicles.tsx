'use client';

import { VehicleMarker } from '@/components/line-schedule/VehicleMarker';
import { useVehiclesQuery } from '@/components/line-schedule/useVehiclesQuery';

/**
 * Renders the real-time vehicle markers for a bus line referenced by
 * the currently-selected OD itinerary. Mounted from `MapCanvas` once
 * per unique (shortName, directionId) pair in the itinerary's bus
 * legs.
 *
 * On a looped line (line 4 is Centro ↔ El General both ways), the
 * outbound bus sits on the opposite side of the city from the
 * inbound one. We render BOTH so the user knows there's activity on
 * the line — but the bus going AGAINST the user's leg direction is
 * dimmed so it doesn't read as "the bus you'd take". Runtime-only;
 * coverage excluded.
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
  return (
    <>
      {v.data.vehicles.map((vh) => {
        const matchesLeg = directionId === null || vh.directionId === directionId;
        return (
          <VehicleMarker
            key={vh.id}
            shortName={shortName}
            label={vh.label}
            headsign={headsign}
            lat={vh.lat}
            lng={vh.lon}
            bearing={vh.bearing}
            timestamp={vh.timestamp}
            dimmed={!matchesLeg}
          />
        );
      })}
    </>
  );
}
/* v8 ignore stop */
