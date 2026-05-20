import * as path from 'node:path';
import { GtfsStaticService } from './gtfs-static.service';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/fixtures/gtfs-mini');

async function loadFixture(): Promise<GtfsStaticService> {
  const service = new GtfsStaticService(FIXTURE_DIR);
  await service.onModuleInit();
  return service;
}

describe('GtfsStaticService', () => {
  describe('routes', () => {
    it('R-02 indexes routes by route_short_name', async () => {
      const service = await loadFixture();
      const route = service.getRoute('4');
      expect(route).toBeDefined();
      expect(route?.routeId).toBe('4');
      expect(route?.routeShortName).toBe('4');
      expect(route?.agencyId).toBe('sol-antigua');
    });
  });

  describe('trips', () => {
    it('R-02 indexes trips by trip_id', async () => {
      const service = await loadFixture();
      const trip = service.getTrip('4-weekday-1-0830');
      expect(trip).toBeDefined();
      expect(trip?.tripId).toBe('4-weekday-1-0830');
      expect(trip?.routeId).toBe('4');
      expect(trip?.serviceId).toBe('weekday');
      expect(trip?.directionId).toBe(1);
    });

    it('R-05 indexes trips by (route_short_name, direction_id)', async () => {
      const service = await loadFixture();
      const outbound = service.getTripsByRouteAndDirection('4', 1);
      expect(outbound).toHaveLength(1);
      expect(outbound[0].tripId).toBe('4-weekday-1-0830');

      const inbound = service.getTripsByRouteAndDirection('4', 0);
      expect(inbound).toHaveLength(1);
      expect(inbound[0].tripId).toBe('4-weekday-0-0800');
    });
  });

  describe('stops', () => {
    it('R-02 indexes stops by stop_id with lat/lon', async () => {
      const service = await loadFixture();
      const stop = service.getStop('S1');
      expect(stop).toBeDefined();
      expect(stop?.stopId).toBe('S1');
      expect(stop?.stopName).toBe('REAL');
      expect(stop?.stopLat).toBeCloseTo(-34.470692, 5);
      expect(stop?.stopLon).toBeCloseTo(-57.852200, 5);
    });
  });

  describe('stop_times', () => {
    it('R-05 returns stop_times for a trip in stop_sequence order', async () => {
      const service = await loadFixture();
      const stopTimes = service.getStopTimes('4-weekday-0-0800');
      expect(stopTimes).toHaveLength(5);
      expect(stopTimes.map((s) => s.stopId)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5']);
      expect(stopTimes[0].arrivalTime).toBe('08:00:00');
      expect(stopTimes[0].stopSequence).toBe(1);
      expect(stopTimes[4].stopSequence).toBe(5);
    });
  });

  describe('calendar', () => {
    it('R-05 indexes calendar entries by service_id with day flags', async () => {
      const service = await loadFixture();
      const weekday = service.getCalendarEntry('weekday');
      expect(weekday).toBeDefined();
      expect(weekday?.serviceId).toBe('weekday');
      expect(weekday?.days).toEqual({
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 0,
        sunday: 0,
      });
      expect(weekday?.startDate).toBe('20260101');
      expect(weekday?.endDate).toBe('20261231');
    });
  });

  describe('calendar_dates', () => {
    it('R-05 indexes calendar exceptions by (service_id, date)', async () => {
      const service = await loadFixture();
      expect(service.getCalendarException('holiday', '20260101')).toBe(1);
      expect(service.getCalendarException('weekday', '20260101')).toBe(2);
      expect(service.getCalendarException('weekday', '20260102')).toBeUndefined();
    });
  });
});
