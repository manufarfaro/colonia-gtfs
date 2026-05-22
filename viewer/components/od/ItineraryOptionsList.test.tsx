import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import type { RestItinerary } from '@/lib/otp/translate-plan';
import { ItineraryOptionsList } from './ItineraryOptionsList';

function withItin(overrides: Partial<RestItinerary> = {}): RestItinerary {
  return {
    durationSeconds: 1800,
    walkDistanceMeters: 450.5,
    fare: { regular: { cents: 5000, currency: 'UYU' } },
    legs: [
      {
        mode: 'BUS',
        durationSeconds: 1200,
        distanceMeters: 4200,
        startTime: '2026-05-21T12:00:00Z',
        endTime: '2026-05-21T12:20:00Z',
        realtimeState: null,
        route: { shortName: '4', longName: 'Línea 4' },
        legGeometry: null,
        from: { name: 'A', lat: 0, lon: 0, stopId: '1:1' },
        to: { name: 'B', lat: 0, lon: 0, stopId: '1:2' },
      },
    ],
    ...overrides,
  };
}

function renderList(
  itineraries: RestItinerary[],
  selectedIndex: number,
  onSelect: (i: number) => void = vi.fn(),
): void {
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ItineraryOptionsList
        itineraries={itineraries}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
      />
    </NextIntlClientProvider>,
  );
}

describe('ItineraryOptionsList', () => {
  it('renders one option per itinerary with selected state on the chosen index', () => {
    renderList([withItin(), withItin({ durationSeconds: 2700 })], 1);
    const a = screen.getByTestId('itinerary-option-0');
    const b = screen.getByTestId('itinerary-option-1');
    expect(a.getAttribute('data-selected')).toBe('false');
    expect(b.getAttribute('data-selected')).toBe('true');
  });

  it('fires onSelect with the option index on click', () => {
    const onSelect = vi.fn();
    renderList([withItin(), withItin()], 0, onSelect);
    fireEvent.click(screen.getByTestId('itinerary-option-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('renders a line-chip per bus leg with the line short name', () => {
    renderList([withItin()], 0);
    expect(screen.getByTestId('itinerary-option-0-line-4')).toBeInTheDocument();
  });

  it('renders the walk-only label when an itinerary has no bus legs', () => {
    const walkOnly = withItin({
      legs: [
        {
          mode: 'WALK',
          durationSeconds: 1800,
          distanceMeters: 1500,
          startTime: '2026-05-21T12:00:00Z',
          endTime: '2026-05-21T12:30:00Z',
          realtimeState: null,
          route: null,
          legGeometry: null,
          from: { name: 'A', lat: 0, lon: 0, stopId: null },
          to: { name: 'B', lat: 0, lon: 0, stopId: null },
        },
      ],
    });
    renderList([walkOnly], 0);
    expect(screen.getByTestId('itinerary-option-0-walk-only')).toBeInTheDocument();
  });

  it('formats fare from cents and falls back to the unconfirmed copy', () => {
    renderList([withItin({ fare: null }), withItin({ fare: { regular: { cents: 7500, currency: 'UYU' } } })], 0);
    expect(screen.getByText('Consultar al chofer')).toBeInTheDocument();
    expect(screen.getByText('UYU $75.00')).toBeInTheDocument();
  });

  it('renders an em-dash for a bus leg with no route (defensive fallback)', () => {
    const noRoute = withItin({
      legs: [
        {
          mode: 'BUS',
          durationSeconds: 1200,
          distanceMeters: 4200,
          startTime: '2026-05-21T12:00:00Z',
          endTime: '2026-05-21T12:20:00Z',
          realtimeState: null,
          route: null,
          legGeometry: null,
          from: { name: 'A', lat: 0, lon: 0, stopId: '1:1' },
          to: { name: 'B', lat: 0, lon: 0, stopId: '1:2' },
        },
      ],
    });
    renderList([noRoute], 0);
    const chip = screen.getByTestId('itinerary-option-0-line-—');
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain('—');
  });
});
