import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import esMessages from '@/messages/es.json';
import type { RestItinerary } from '@/lib/otp/translate-plan';
import { ItineraryCard } from './ItineraryCard';

function withProvider(ui: React.ReactElement): React.ReactElement {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function baseItinerary(): RestItinerary {
  return {
    durationSeconds: 1210,
    walkDistanceMeters: 432.59,
    fare: { regular: { cents: 7500, currency: 'UYU' } },
    legs: [
      {
        mode: 'WALK',
        durationSeconds: 222,
        distanceMeters: 293.3,
        startTime: '2026-06-02T11:30:00.000Z',
        endTime: '2026-06-02T11:33:42.000Z',
        realtimeState: null,
        route: null,
        legGeometry: { points: 'a' },
        from: { name: 'Origin', lat: 0, lon: 0, stopId: null },
        to: { name: 'ITUZAINGO', lat: 0, lon: 0, stopId: '1:2' },
      },
      {
        mode: 'BUS',
        durationSeconds: 874,
        distanceMeters: 8224,
        startTime: '2026-06-02T11:33:42.000Z',
        endTime: '2026-06-02T11:48:16.000Z',
        realtimeState: 'SCHEDULED',
        route: { shortName: '4', longName: 'Línea 4' },
        legGeometry: { points: 'b' },
        from: { name: 'ITUZAINGO', lat: 0, lon: 0, stopId: '1:2' },
        to: { name: 'CURVA', lat: 0, lon: 0, stopId: '1:121' },
      },
      {
        mode: 'WALK',
        durationSeconds: 114,
        distanceMeters: 139.28,
        startTime: '2026-06-02T11:48:16.000Z',
        endTime: '2026-06-02T11:50:10.000Z',
        realtimeState: null,
        route: null,
        legGeometry: null,
        from: { name: 'CURVA', lat: 0, lon: 0, stopId: '1:121' },
        to: { name: 'Destination', lat: 0, lon: 0, stopId: null },
      },
    ],
  };
}

describe('ItineraryCard', () => {
  it('R-05 renders total duration (minutes) and walk distance (meters, rounded)', () => {
    render(withProvider(<ItineraryCard itinerary={baseItinerary()} />));
    // 1210 s → 21 min (rounded up), walk 432.59 m → 433 m
    expect(screen.getByTestId('itinerary-duration').textContent).toContain('21');
    expect(screen.getByTestId('itinerary-walk').textContent).toContain('433');
  });

  it('R-05 shows the fare value with two decimals when fare.regular is set', () => {
    render(withProvider(<ItineraryCard itinerary={baseItinerary()} />));
    expect(screen.getByTestId('itinerary-fare').textContent).toContain('UYU $75.00');
  });

  it('R-05 falls back to "Consultar al chofer" when fare is null', () => {
    const it = { ...baseItinerary(), fare: null };
    render(withProvider(<ItineraryCard itinerary={it} />));
    expect(screen.getByTestId('itinerary-fare').textContent).toContain('Consultar al chofer');
  });

  it('R-05 renders a row per leg with walk vs bus copy', () => {
    render(withProvider(<ItineraryCard itinerary={baseItinerary()} />));
    const rows = screen.getAllByTestId(/^itinerary-leg-/);
    expect(rows).toHaveLength(3);
    // Walk row: minutes + destination name
    expect(rows[0].textContent).toMatch(/Caminar/);
    expect(rows[0].textContent).toMatch(/ITUZAINGO/);
    // Bus row: line shortName + minutes + destination
    expect(rows[1].textContent).toMatch(/4/);
    expect(rows[1].textContent).toMatch(/CURVA/);
    // Last walk row
    expect(rows[2].textContent).toMatch(/Caminar/);
    expect(rows[2].textContent).toMatch(/Destination/);
  });
});
