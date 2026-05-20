import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from 'gtfs-realtime-bindings';
import { decodeVehicleFeed, filterByLine } from './decode-vehicles';

const { transit_realtime } = pkg;

const fixturePath = resolve(__dirname, '../../test/fixtures/bridge/vehicle-positions.pb');
const pb = readFileSync(fixturePath);

function encode(feed: Parameters<typeof transit_realtime.FeedMessage.create>[0]): Uint8Array {
  return transit_realtime.FeedMessage.encode(transit_realtime.FeedMessage.create(feed)).finish();
}

describe('decodeVehicleFeed', () => {
  it('R-07 decodes the FeedMessage', () => {
    const feed = decodeVehicleFeed(new Uint8Array(pb));
    expect(feed.header.timestamp).toBeGreaterThan(0);
    expect(feed.entities.length).toBe(4);
  });

  it('R-07 maps entity → { id, label, routeId, directionId, lat, lon, bearing, timestamp }', () => {
    const feed = decodeVehicleFeed(new Uint8Array(pb));
    const sample = feed.entities.find((e) => e.label === 'L4' && e.directionId === 0)!;
    expect(sample.routeId).toBe('4');
    expect(sample.lat).toBeCloseTo(-34.4706, 4);
    expect(sample.lon).toBeCloseTo(-57.8471, 4);
    expect(sample.bearing).toBe(90);
  });

  it('R-07 skips entities with no vehicle and entities with no position', () => {
    const bytes = encode({
      header: { gtfsRealtimeVersion: '2.0', timestamp: 1000 },
      entity: [
        { id: 'no-vehicle' /* vehicle omitted */ },
        { id: 'no-position', vehicle: { vehicle: { id: 'v', label: 'L9' } /* position omitted */ } },
        { id: 'ok', vehicle: { vehicle: { id: 'v2', label: 'L9' }, position: { latitude: 0, longitude: 0 } } },
      ],
    });
    const feed = decodeVehicleFeed(bytes);
    expect(feed.entities.map((e) => e.id)).toEqual(['ok']);
  });

  it('R-07 nulls message-typed optionals (vehicle, trip, timestamp) when the upstream omits them', () => {
    // Note: proto3 represents unset message-typed fields as undefined
    // (so `vehicle.label`, `trip.routeId`, `trip.directionId` decode as
    // `?? null`). Numeric primitives decode as their proto default (0)
    // and are kept literal — 0 is a meaningful bearing, not "no data".
    // `timestamp` happens to land as null because we treat the proto-3
    // sentinel 0 as "unset" (since a 1970-epoch ts has no meaning here).
    const bytes = encode({
      header: { gtfsRealtimeVersion: '2.0', timestamp: 1000 },
      entity: [
        {
          id: 'minimal',
          vehicle: {
            // No vehicle (descriptor), no trip, no bearing, no timestamp.
            position: { latitude: -34.0, longitude: -57.0 },
          },
        },
      ],
    });
    const feed = decodeVehicleFeed(bytes);
    const e = feed.entities[0];
    expect(e.label).toBeNull();
    expect(e.routeId).toBeNull();
    expect(e.directionId).toBeNull();
    expect(e.timestamp).toBeNull();
  });

  it('R-07 defaults header fields when the upstream omits them', () => {
    const bytes = encode({ header: { gtfsRealtimeVersion: '2.0' }, entity: [] });
    const feed = decodeVehicleFeed(bytes);
    expect(feed.header.timestamp).toBe(0);
    expect(feed.header.gtfsRealtimeVersion).toBe('2.0');
    expect(feed.entities).toEqual([]);
  });

});

describe('filterByLine', () => {
  it('R-07 returns only entries matching label=L<id> OR routeId=<id>', () => {
    const feed = decodeVehicleFeed(new Uint8Array(pb));
    const four = filterByLine(feed.entities, '4');
    expect(four.length).toBe(2);
    four.forEach((v) => {
      expect(v.label === 'L4' || v.routeId === '4').toBe(true);
    });
  });

  it('R-07 returns empty array when line has no vehicles', () => {
    const feed = decodeVehicleFeed(new Uint8Array(pb));
    expect(filterByLine(feed.entities, '99')).toEqual([]);
  });

  it('R-07 returns L3 single vehicle', () => {
    const feed = decodeVehicleFeed(new Uint8Array(pb));
    const three = filterByLine(feed.entities, '3');
    expect(three.length).toBe(1);
    expect(three[0].label).toBe('L3');
  });
});
