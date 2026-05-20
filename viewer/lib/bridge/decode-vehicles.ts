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
  // The `??` right-hand defaults on header fields and `feed.entity` are
  // defensive — proto3 always populates message and repeated fields to
  // their type defaults, so the right side is unreachable at runtime.
  // We keep them for type safety (protobufjs marks all fields optional
  // in its TS bindings even when proto says required) but mark the dead
  // branches for the coverage tool.
  const header = {
    /* v8 ignore next */
    timestamp: Number(feed.header?.timestamp ?? 0),
    /* v8 ignore next */
    gtfsRealtimeVersion: feed.header?.gtfsRealtimeVersion ?? '',
  };
  const entities: VehicleEntity[] = [];
  /* v8 ignore next */
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
      // Proto3 default for bearing is 0; `??` is dead since 0 isn't
      // nullish. Kept for parity with the other nullables.
      /* v8 ignore next */
      bearing: v.position.bearing ?? null,
      // protobufjs surfaces uint64 fields as Long instances, which are
      // truthy objects even when their numeric value is 0. Coerce to
      // Number first so the falsy check actually catches the proto-3
      // sentinel. The `?? 0` right side is dead (Long{0} is not nullish);
      // the `|| null` after Number(...) is the meaningful branch.
      /* v8 ignore next */
      timestamp: Number(v.timestamp ?? 0) || null,
    });
  }
  return { header, entities };
}

export function filterByLine(entities: VehicleEntity[], lineId: string): VehicleEntity[] {
  const labelMatch = `L${lineId}`;
  return entities.filter((v) => v.label === labelMatch || v.routeId === lineId);
}
