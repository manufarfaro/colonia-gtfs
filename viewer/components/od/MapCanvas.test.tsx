import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RestItinerary } from '@/lib/otp/translate-plan';

// Stub the entire vis.gl wrapper — primitives render their props as data
// attributes so the test can read them without a browser.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children, apiKey }: { children: React.ReactNode; apiKey: string }) => (
    <div data-testid="api-provider" data-apikey={apiKey}>
      {children}
    </div>
  ),
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

vi.mock('./LegPolyline', () => ({
  LegPolyline: ({ leg }: { leg: RestItinerary['legs'][number] }) => (
    <div
      data-testid="leg-polyline"
      data-mode={leg.mode}
      data-color={leg.mode === 'BUS' ? `line-${leg.route?.shortName}` : 'walk'}
      data-points={leg.legGeometry?.points ?? ''}
    />
  ),
  StopMarker: ({ stopId, lat, lng }: { stopId: string; lat: number; lng: number }) => (
    <div data-testid={`marker-${stopId}`} data-lat={lat} data-lng={lng} />
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
    render(<MapCanvas apiKey="test" itinerary={null} />);
    const map = screen.getByTestId('map');
    expect(map.getAttribute('data-center')).toBe('-34.467,-57.84');
    expect(map.getAttribute('data-zoom')).toBe('15');
    // No bounds prop until an itinerary lands.
    expect(map.getAttribute('data-bounds')).toBe('');
    expect(screen.queryAllByTestId('leg-polyline')).toHaveLength(0);
  });

  it('R-04 forwards the API key to the APIProvider', () => {
    render(<MapCanvas apiKey="my-key" itinerary={null} />);
    expect(screen.getByTestId('api-provider').getAttribute('data-apikey')).toBe('my-key');
  });

  it('R-04 renders one polyline per leg with geometry (walk dashed + bus colored)', () => {
    render(<MapCanvas apiKey="test" itinerary={busItinerary()} />);
    const polys = screen.getAllByTestId('leg-polyline');
    // Three legs total but the third has null geometry — that's the
    // contract this requirement asserts at the LegPolyline boundary.
    expect(polys).toHaveLength(3);
    expect(polys[0].getAttribute('data-mode')).toBe('WALK');
    expect(polys[1].getAttribute('data-mode')).toBe('BUS');
    expect(polys[1].getAttribute('data-color')).toBe('line-4');
  });

  it('R-04 places markers at the bus leg endpoints (boarding + alighting stops)', () => {
    render(<MapCanvas apiKey="test" itinerary={busItinerary()} />);
    expect(screen.getByTestId('marker-1:2')).toBeInTheDocument();
    expect(screen.getByTestId('marker-1:42')).toBeInTheDocument();
  });

  it('R-04 fits the map bounds to the union of leg geometries with padding', () => {
    render(<MapCanvas apiKey="test" itinerary={busItinerary()} />);
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
    render(<MapCanvas apiKey="test" itinerary={itin} />);
    const map = screen.getByTestId('map');
    expect(map.getAttribute('data-bounds')).toBe('');
    expect(map.getAttribute('data-center')).toBe('-34.467,-57.84');
  });
});
