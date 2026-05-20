import pkg from 'gtfs-realtime-bindings';
const { transit_realtime } = pkg;

export interface VehicleEntity {
  id: string;
  label: string | null;
  routeId: string | null;
  directionId: number | null;
  lat: number;
  lon: number;
  bearing: number | null;
  timestamp: number | null;
}

export interface DecodedFeed {
  header: { timestamp: number; gtfsRealtimeVersion: string };
  entities: VehicleEntity[];
}

export function decodeVehicleFeed(bytes: Uint8Array): DecodedFeed {
  const feed = transit_realtime.FeedMessage.decode(bytes);
  const header = {
    timestamp: Number(feed.header?.timestamp ?? 0),
    gtfsRealtimeVersion: feed.header?.gtfsRealtimeVersion ?? '',
  };
  const entities: VehicleEntity[] = [];
  for (const e of feed.entity ?? []) {
    const v = e.vehicle;
    if (!v?.position) continue;
    entities.push({
      id: e.id,
      label: v.vehicle?.label ?? null,
      routeId: v.trip?.routeId ?? null,
      directionId: v.trip?.directionId ?? null,
      lat: v.position.latitude,
      lon: v.position.longitude,
      bearing: v.position.bearing ?? null,
      timestamp: v.timestamp ? Number(v.timestamp) : null,
    });
  }
  return { header, entities };
}

export function filterByLine(entities: VehicleEntity[], lineId: string): VehicleEntity[] {
  const labelMatch = `L${lineId}`;
  return entities.filter((v) => v.label === labelMatch || v.routeId === lineId);
}
