'use client';

import { VehicleMarker } from '@/components/line-schedule/VehicleMarker';
import { useVehiclesQuery } from '@/components/line-schedule/useVehiclesQuery';

/**
 * Renders the real-time vehicle markers for ONE bus line referenced by
 * the currently-selected OD itinerary. Mounted from `MapCanvas` once
 * per unique line shortName in the itinerary's bus legs. Pure runtime
 * component — coverage excluded.
 */
/* v8 ignore start */
export function OdItineraryVehicles({
  shortName,
  headsign,
}: {
  shortName: string;
  headsign: string | null;
}): React.ReactElement | null {
  const v = useVehiclesQuery(shortName);
  if (v.state !== 'success') return null;
  return (
    <>
      {v.data.vehicles.map((vh) => (
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
