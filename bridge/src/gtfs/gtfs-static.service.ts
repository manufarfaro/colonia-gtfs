import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface Route {
  routeId: string;
  agencyId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: number;
}

export interface Trip {
  tripId: string;
  routeId: string;
  serviceId: string;
  directionId: 0 | 1;
  tripHeadsign: string;
  originalTripId: string;
}

export interface Stop {
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
}

export interface StopTime {
  tripId: string;
  arrivalTime: string;
  departureTime: string;
  stopId: string;
  stopSequence: number;
}

export interface CalendarEntry {
  serviceId: string;
  days: {
    monday: 0 | 1;
    tuesday: 0 | 1;
    wednesday: 0 | 1;
    thursday: 0 | 1;
    friday: 0 | 1;
    saturday: 0 | 1;
    sunday: 0 | 1;
  };
  startDate: string;
  endDate: string;
}

type ExceptionType = 1 | 2;

interface CsvRow {
  [column: string]: string;
}

async function readCsv(filePath: string): Promise<CsvRow[]> {
  const raw = await fs.readFile(filePath, 'utf8');
  const [header, ...rows] = raw.trim().split('\n');
  const cols = header.split(',');
  return rows.map((row) => {
    const cells = row.split(',');
    const obj: CsvRow = {};
    cols.forEach((c, i) => {
      obj[c] = cells[i] ?? '';
    });
    return obj;
  });
}

@Injectable()
export class GtfsStaticService {
  private routes = new Map<string, Route>();
  private trips = new Map<string, Trip>();
  private tripsByRouteAndDirection = new Map<string, Trip[]>();
  private stops = new Map<string, Stop>();
  private stopTimesByTrip = new Map<string, StopTime[]>();
  private calendar = new Map<string, CalendarEntry>();
  private calendarDates = new Map<string, ExceptionType>();

  constructor(private readonly gtfsDir: string) {}

  async onModuleInit(): Promise<void> {
    await this.loadRoutes();
    await this.loadTrips();
    await this.loadStops();
    await this.loadStopTimes();
    await this.loadCalendar();
    await this.loadCalendarDates();
  }

  private async loadRoutes(): Promise<void> {
    const rows = await readCsv(path.join(this.gtfsDir, 'routes.txt'));
    for (const r of rows) {
      const route: Route = {
        routeId: r.route_id,
        agencyId: r.agency_id,
        routeShortName: r.route_short_name,
        routeLongName: r.route_long_name,
        routeType: Number.parseInt(r.route_type, 10),
      };
      this.routes.set(route.routeShortName, route);
    }
  }

  private async loadTrips(): Promise<void> {
    const rows = await readCsv(path.join(this.gtfsDir, 'trips.txt'));
    for (const r of rows) {
      const trip: Trip = {
        tripId: r.trip_id,
        routeId: r.route_id,
        serviceId: r.service_id,
        directionId: Number.parseInt(r.direction_id, 10) as 0 | 1,
        tripHeadsign: r.trip_headsign ?? '',
        originalTripId: r.original_trip_id ?? '',
      };
      this.trips.set(trip.tripId, trip);
      const route = this.routes.get(trip.routeId);
      if (route) {
        const key = `${route.routeShortName}-${trip.directionId}`;
        const existing = this.tripsByRouteAndDirection.get(key) ?? [];
        existing.push(trip);
        this.tripsByRouteAndDirection.set(key, existing);
      }
    }
  }

  private async loadStops(): Promise<void> {
    const rows = await readCsv(path.join(this.gtfsDir, 'stops.txt'));
    for (const r of rows) {
      const stop: Stop = {
        stopId: r.stop_id,
        stopName: r.stop_name,
        stopLat: Number.parseFloat(r.stop_lat),
        stopLon: Number.parseFloat(r.stop_lon),
      };
      this.stops.set(stop.stopId, stop);
    }
  }

  private async loadStopTimes(): Promise<void> {
    const rows = await readCsv(path.join(this.gtfsDir, 'stop_times.txt'));
    for (const r of rows) {
      const stopTime: StopTime = {
        tripId: r.trip_id,
        arrivalTime: r.arrival_time,
        departureTime: r.departure_time,
        stopId: r.stop_id,
        stopSequence: Number.parseInt(r.stop_sequence, 10),
      };
      const existing = this.stopTimesByTrip.get(stopTime.tripId) ?? [];
      existing.push(stopTime);
      this.stopTimesByTrip.set(stopTime.tripId, existing);
    }
    // Sort each trip's stop_times by sequence
    for (const list of this.stopTimesByTrip.values()) {
      list.sort((a, b) => a.stopSequence - b.stopSequence);
    }
  }

  private async loadCalendar(): Promise<void> {
    const rows = await readCsv(path.join(this.gtfsDir, 'calendar.txt'));
    for (const r of rows) {
      const entry: CalendarEntry = {
        serviceId: r.service_id,
        days: {
          monday: Number.parseInt(r.monday, 10) as 0 | 1,
          tuesday: Number.parseInt(r.tuesday, 10) as 0 | 1,
          wednesday: Number.parseInt(r.wednesday, 10) as 0 | 1,
          thursday: Number.parseInt(r.thursday, 10) as 0 | 1,
          friday: Number.parseInt(r.friday, 10) as 0 | 1,
          saturday: Number.parseInt(r.saturday, 10) as 0 | 1,
          sunday: Number.parseInt(r.sunday, 10) as 0 | 1,
        },
        startDate: r.start_date,
        endDate: r.end_date,
      };
      this.calendar.set(entry.serviceId, entry);
    }
  }

  private async loadCalendarDates(): Promise<void> {
    const rows = await readCsv(path.join(this.gtfsDir, 'calendar_dates.txt'));
    for (const r of rows) {
      const key = `${r.service_id}-${r.date}`;
      this.calendarDates.set(key, Number.parseInt(r.exception_type, 10) as ExceptionType);
    }
  }

  getRoute(routeShortName: string): Route | undefined {
    return this.routes.get(routeShortName);
  }

  getTrip(tripId: string): Trip | undefined {
    return this.trips.get(tripId);
  }

  getTripsByRouteAndDirection(routeShortName: string, directionId: 0 | 1): Trip[] {
    return this.tripsByRouteAndDirection.get(`${routeShortName}-${directionId}`) ?? [];
  }

  getStop(stopId: string): Stop | undefined {
    return this.stops.get(stopId);
  }

  getStopTimes(tripId: string): StopTime[] {
    return this.stopTimesByTrip.get(tripId) ?? [];
  }

  getCalendarEntry(serviceId: string): CalendarEntry | undefined {
    return this.calendar.get(serviceId);
  }

  getCalendarException(serviceId: string, yyyymmdd: string): ExceptionType | undefined {
    return this.calendarDates.get(`${serviceId}-${yyyymmdd}`);
  }
}
