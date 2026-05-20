import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeVehicleFeed, filterByLine } from './decode-vehicles';

const fixturePath = resolve(__dirname, '../../test/fixtures/bridge/vehicle-positions.pb');
const pb = readFileSync(fixturePath);

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
