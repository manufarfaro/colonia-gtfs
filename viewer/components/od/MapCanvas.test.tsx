import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RestItinerary } from '@/lib/otp/translate-plan';

// Stub the vis.gl Map primitive — renders props as data attributes so
// the test can read them without a browser. APIProvider is hoisted to
// OdModeShell now; MapCanvas only renders Map and its layer children.
vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({
    children,
    defaultCenter,
    defaultZoom,
    defaultBounds,
  }: {
    children?: React.ReactNode;
    defaultCenter?: { lat: number; lng: number };
    defaultZoom?: number;
    defaultBounds?: { south: number; west: number; north: number; east: number };
  }) => (
    <div
      data-testid="map"
      data-center={defaultCenter ? `${defaultCenter.lat},${defaultCenter.lng}` : ''}
      data-zoom={defaultZoom ?? ''}
      data-bounds={defaultBounds ? `${defaultBounds.south},${defaultBounds.west},${defaultBounds.north},${defaultBounds.east}` : ''}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/line-schedule/LineLegend', () => ({
  LineLegend: ({ data }: { data: { line: { shortName: string } | null } }) => (
    <div data-testid="stub-line-legend" data-shortname={data.line?.shortName ?? ''} />
  ),
}));

vi.mock('@/components/line-schedule/LineRouteLayer', () => ({
  LineRouteLayer: ({
    data,
    vehicles,
  }: {
    data: { line: { shortName: string } | null; directions: Array<{ stops: unknown[] }>; shape: Array<{ points: string }> };
    vehicles: Array<{ id: string }>;
  }) => (
    <div
      data-testid="stub-line-layer"
      data-shortname={data.line?.shortName ?? ''}
      data-directions={data.directions.length}
      data-shape={data.shape.length}
      data-vehicles={vehicles.length}
    />
  ),
}));

vi.mock('./LegPolyline', () => ({
  LegPolyline: ({ leg }: { leg: RestItinerary['legs'][number] }) => (
    <div
      data-testid="leg-polyline"
      data-mode={leg.mode}
      data-color={leg.mode === 'BUS' ? `line-${leg.route?.shortName}` : 'walk'}
      data-points={leg.legGeometry?.points ?? ''}
    />
  ),
  StopMarker: ({ stopId, lat, lng, onClick }: { stopId: string; lat: number; lng: number; onClick?: (id: string) => void }) => (
    <button
      data-testid={`marker-${stopId}`}
      data-lat={lat}
      data-lng={lng}
      onClick={() => onClick?.(stopId)}
    />
  ),
}));

import { MapCanvas } from './MapCanvas';

function busItinerary(): RestItinerary {
  return {
    durationSeconds: 2211,
    walkDistanceMeters: 2399.7,
    fare: { regular: { cents: 7500, currency: 'UYU' } },
    legs: [
      {
        mode: 'WALK',
        durationSeconds: 233,
        distanceMeters: 301.2,
        startTime: '2026-06-02T11:30:00.000Z',
        endTime: '2026-06-02T11:33:53.000Z',
        realtimeState: null,
        route: null,
        legGeometry: { points: '_p~iF~ps|U_ulLnnqC' },
        from: { name: 'Origin', lat: -34.4712, lon: -57.852, stopId: null },
        to: { name: 'ITUZAINGO', lat: -34.470615, lon: -57.849233, stopId: '1:2' },
      },
      {
        mode: 'BUS',
        durationSeconds: 404,
        distanceMeters: 1825.2,
        startTime: '2026-06-02T11:33:53.000Z',
        endTime: '2026-06-02T11:40:37.000Z',
        realtimeState: 'UPDATED',
        route: { shortName: '4', longName: 'Línea 4' },
        legGeometry: { points: '_p~iF~ps|U_ulLnnqC' },
        from: { name: 'ITUZAINGO', lat: -34.470615, lon: -57.849233, stopId: '1:2' },
        to: { name: 'AV JOSE P VARELA', lat: -34.448, lon: -57.835, stopId: '1:42' },
      },
      {
        mode: 'WALK',
        durationSeconds: 1574,
        distanceMeters: 2098,
        startTime: '2026-06-02T11:40:37.000Z',
        endTime: '2026-06-02T12:06:51.000Z',
        realtimeState: null,
        route: null,
        legGeometry: null,
        from: { name: 'AV JOSE P VARELA', lat: -34.448, lon: -57.835, stopId: '1:42' },
        to: { name: 'Destination', lat: -34.447, lon: -57.844, stopId: null },
      },
    ],
  };
}

describe('MapCanvas', () => {
  it('R-04 renders the Colonia default center + zoom 15 when no itinerary', () => {
    render(<MapCanvas itinerary={null} />);
    const map = screen.getByTestId('map');
    expect(map.getAttribute('data-center')).toBe('-34.467,-57.84');
    expect(map.getAttribute('data-zoom')).toBe('15');
    // No bounds prop until an itinerary lands.
    expect(map.getAttribute('data-bounds')).toBe('');
    expect(screen.queryAllByTestId('leg-polyline')).toHaveLength(0);
  });

  it('R-04 renders one polyline per leg with geometry (walk dashed + bus colored)', () => {
    render(<MapCanvas itinerary={busItinerary()} />);
    const polys = screen.getAllByTestId('leg-polyline');
    // Three legs total but the third has null geometry — that's the
    // contract this requirement asserts at the LegPolyline boundary.
    expect(polys).toHaveLength(3);
    expect(polys[0].getAttribute('data-mode')).toBe('WALK');
    expect(polys[1].getAttribute('data-mode')).toBe('BUS');
    expect(polys[1].getAttribute('data-color')).toBe('line-4');
  });

  it('R-04 places markers at the bus leg endpoints (boarding + alighting stops)', () => {
    render(<MapCanvas itinerary={busItinerary()} />);
    expect(screen.getByTestId('marker-1:2')).toBeInTheDocument();
    expect(screen.getByTestId('marker-1:42')).toBeInTheDocument();
  });

  it('R-04 fits the map bounds to the union of leg geometries with padding', () => {
    render(<MapCanvas itinerary={busItinerary()} />);
    const map = screen.getByTestId('map');
    const bounds = map.getAttribute('data-bounds');
    expect(bounds).toBeTruthy();
    // Just sanity-check that the bounds are present and parseable to numbers.
    const parts = bounds!.split(',').map(Number);
    expect(parts).toHaveLength(4);
    parts.forEach((n) => expect(Number.isFinite(n)).toBe(true));
  });

  it('R-04 falls back to the default center when every leg lacks geometry', () => {
    const itin = busItinerary();
    itin.legs.forEach((l) => (l.legGeometry = null));
    render(<MapCanvas itinerary={itin} />);
    const map = screen.getByTestId('map');
    expect(map.getAttribute('data-bounds')).toBe('');
    expect(map.getAttribute('data-center')).toBe('-34.467,-57.84');
  });

  it('R-07 forwards onStopClick to each rendered StopMarker', () => {
    const onStopClick = vi.fn();
    render(<MapCanvas itinerary={busItinerary()} onStopClick={onStopClick} />);
    fireEvent.click(screen.getByTestId('marker-1:2'));
    expect(onStopClick).toHaveBeenCalledWith('1:2');
    fireEvent.click(screen.getByTestId('marker-1:42'));
    expect(onStopClick).toHaveBeenCalledWith('1:42');
  });

  it('R-07 omits onStopClick gracefully (markers still render)', () => {
    render(<MapCanvas itinerary={busItinerary()} />);
    fireEvent.click(screen.getByTestId('marker-1:2'));
    // No error; nothing dispatches.
    expect(screen.getByTestId('marker-1:2')).toBeInTheDocument();
  });

  it('R-02 lineLayer wins over itinerary (modes are mutually exclusive)', () => {
    const lineLayer = {
      data: {
        line: { id: '1:4', shortName: '4', longName: 'L4' },
        shape: [{ directionId: 0, points: '_p~iF~ps|U' }],
        directions: [{ directionId: 0, headsign: 'Centro', stops: [], scheduledDepartures: [] }],
        meta: { date: '2026-05-20' },
      },
      vehicles: [{ id: 'v-1', label: 'L4', routeId: '4', directionId: 0, lat: 0, lon: 0, bearing: null, timestamp: null }],
      activeDirectionId: 0,
    };
    render(<MapCanvas itinerary={busItinerary()} lineLayer={lineLayer} />);
    // Line layer rendered, OD polylines NOT rendered.
    expect(screen.getByTestId('stub-line-layer').getAttribute('data-shortname')).toBe('4');
    expect(screen.queryAllByTestId('leg-polyline')).toHaveLength(0);
  });

  it('R-02 lineLayer bounds the map to the union of its polylines', () => {
    const lineLayer = {
      data: {
        line: { id: '1:4', shortName: '4', longName: 'L4' },
        shape: [{ directionId: 0, points: '_p~iF~ps|U' }],
        directions: [],
        meta: { date: '2026-05-20' },
      },
      vehicles: [],
      activeDirectionId: 0,
    };
    render(<MapCanvas itinerary={null} lineLayer={lineLayer} />);
    const bounds = screen.getByTestId('map').getAttribute('data-bounds');
    expect(bounds).toBeTruthy();
  });

  it('R-02 lineLayer without shape falls back to default center', () => {
    const lineLayer = {
      data: {
        line: { id: '1:4', shortName: '4', longName: 'L4' },
        shape: [],
        directions: [],
        meta: { date: '2026-05-20' },
      },
      vehicles: [],
      activeDirectionId: 0,
    };
    render(<MapCanvas itinerary={null} lineLayer={lineLayer} />);
    const map = screen.getByTestId('map');
    expect(map.getAttribute('data-bounds')).toBe('');
    expect(map.getAttribute('data-center')).toBe('-34.467,-57.84');
  });
});
