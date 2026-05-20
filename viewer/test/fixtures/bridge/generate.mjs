// One-shot fixture generator. Run with `node test/fixtures/bridge/generate.mjs`
// to refresh `vehicle-positions.pb` after tweaking the sample data below.
// The .pb is committed so tests run hermetically without re-encoding.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pkg from 'gtfs-realtime-bindings';
const { transit_realtime } = pkg;

const now = Math.floor(Date.UTC(2026, 4, 19, 14, 30, 0) / 1000);

const feed = transit_realtime.FeedMessage.create({
  header: {
    gtfsRealtimeVersion: '2.0',
    incrementality: 0,
    timestamp: now,
  },
  entity: [
    {
      id: 'sa-001',
      vehicle: {
        vehicle: { id: 'L4-001', label: 'L4' },
        trip: { routeId: '4', directionId: 0 },
        position: { latitude: -34.4706, longitude: -57.8471, bearing: 90 },
        timestamp: now,
      },
    },
    {
      id: 'sa-002',
      vehicle: {
        vehicle: { id: 'L4-002', label: 'L4' },
        trip: { routeId: '4', directionId: 1 },
        position: { latitude: -34.4711, longitude: -57.8434, bearing: 270 },
        timestamp: now,
      },
    },
    {
      id: 'sa-003',
      vehicle: {
        vehicle: { id: 'L3-001', label: 'L3' },
        trip: { routeId: '3', directionId: 0 },
        position: { latitude: -34.475, longitude: -57.84, bearing: 0 },
        timestamp: now,
      },
    },
    {
      id: 'sa-004',
      vehicle: {
        vehicle: { id: 'L5-001', label: 'L5' },
        trip: { routeId: '5', directionId: 0 },
        position: { latitude: -34.472, longitude: -57.846, bearing: 180 },
        timestamp: now,
      },
    },
  ],
});

const buf = transit_realtime.FeedMessage.encode(feed).finish();
const dir = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(dir, 'vehicle-positions.pb'), buf);
console.log(`wrote ${buf.length} bytes to vehicle-positions.pb`);
