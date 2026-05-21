import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import type { RestLineResponse } from '@/lib/otp/translate-line';
import { LineScheduleCard } from './LineScheduleCard';

function withProvider(ui: React.ReactElement): React.ReactElement {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

const twoDirections: RestLineResponse = {
  line: { id: '1:4', shortName: '4', longName: 'Línea 4 — Real de San Carlos' },
  shape: [],
  directions: [
    {
      directionId: 0,
      headsign: 'Centro',
      stops: [
        { id: 'sol-antigua:1', name: 'Terminal', lat: -34.4707, lon: -57.8525, arrivalOffsetSeconds: 0 },
        { id: 'sol-antigua:2', name: 'Plaza Mayor', lat: -34.4708, lon: -57.85, arrivalOffsetSeconds: 360 },
      ],
      scheduledDepartures: ['06:00', '06:30', '07:00'],
    },
    {
      directionId: 1,
      headsign: 'Real de San Carlos',
      stops: [
        { id: 'sol-antigua:2', name: 'Plaza Mayor', lat: 0, lon: 0, arrivalOffsetSeconds: 0 },
      ],
      scheduledDepartures: ['06:30', '07:00'],
    },
  ],
  meta: { date: '2026-05-20' },
};

const oneDirection: RestLineResponse = {
  ...twoDirections,
  directions: [twoDirections.directions[0]],
};

beforeEach(() => {
  // Pin "now" to 06:25 Montevideo so the closest-departure highlight is
  // deterministic across runs.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-21T09:25:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LineScheduleCard', () => {
  it('R-03 renders the line shortName + longName in the header', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    expect(screen.getByTestId('line-card-header').textContent).toContain('Línea 4');
    expect(screen.getByTestId('line-card-header').textContent).toContain('Real de San Carlos');
  });

  it('R-03 renders a tab per direction', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    expect(screen.getByTestId('line-tab-0').textContent).toContain('Centro');
    expect(screen.getByTestId('line-tab-1').textContent).toContain('Real de San Carlos');
  });

  it('R-03 defaults to directionId 0 selected', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    expect(screen.getByTestId('line-tab-0').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('line-tab-1').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });

  it('R-03 switching tabs swaps the visible departures', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    fireEvent.click(screen.getByTestId('line-tab-1'));
    expect(screen.getByTestId('line-tab-1').getAttribute('aria-selected')).toBe('true');
    // Direction 1 only has [06:30, 07:00] — 06:00 should not appear.
    expect(screen.queryByText('06:00')).not.toBeInTheDocument();
    // Within the departures list specifically (06:30 also appears as a
    // stop ETA so we scope by the section's testid).
    const departures = screen.getByTestId('line-departures-section');
    expect(departures.textContent).toContain('06:30');
  });

  it('R-03 single-direction lines render no tab bar', () => {
    render(withProvider(<LineScheduleCard data={oneDirection} />));
    expect(screen.queryByTestId('line-tabs')).not.toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });

  it('R-03 tap on a stop expands an inline detail panel with id + coords + offset', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    expect(screen.queryByTestId('line-stop-detail-sol-antigua:1')).toBeNull();
    fireEvent.click(screen.getByText('Terminal'));
    const detail = screen.getByTestId('line-stop-detail-sol-antigua:1');
    expect(detail.textContent).toContain('sol-antigua:1');
    expect(detail.textContent).toMatch(/-34\.4707/);
    expect(detail.textContent).toMatch(/\+0 min/);
  });

  it('R-03 tap on the same stop collapses the detail panel', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    fireEvent.click(screen.getByText('Terminal'));
    expect(screen.queryByTestId('line-stop-detail-sol-antigua:1')).not.toBeNull();
    fireEvent.click(screen.getByText('Terminal'));
    expect(screen.queryByTestId('line-stop-detail-sol-antigua:1')).toBeNull();
  });

  it('R-03 each stop row shows the next arrival ETA computed from the offset + now', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    // First stop: offset 0 → next arrival = next departure ≥ 06:25 = 06:30
    expect(screen.getByTestId('line-stop-eta-sol-antigua:1').textContent).toBe('06:30');
    // Second stop: offset 360s = 6 min → arrivals at 06:06, 06:36, 07:06.
    // First arrival ≥ 06:25 is 06:36.
    expect(screen.getByTestId('line-stop-eta-sol-antigua:2').textContent).toBe('06:36');
  });

  it('R-03 the departure chip closest to now gets the line-color emphasis', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    const closest = screen.getByTestId('line-departure-closest');
    // now = 06:25 → closest of [06:00, 06:30, 07:00] is 06:30 (distance 5).
    expect(closest.textContent).toBe('06:30');
  });

  it('R-03 renders an em-dash for the stop ETA when all departures are in the past', () => {
    vi.setSystemTime(new Date('2026-05-22T01:00:00Z')); // 22:00 Montevideo — past all 06:00–07:00 departures
    render(withProvider(<LineScheduleCard data={twoDirections} />));
    expect(screen.getByTestId('line-stop-eta-sol-antigua:1').textContent).toBe('—');
  });

  it('R-03 deduplicates the departures list (no repeated chips)', () => {
    const withDup: RestLineResponse = {
      ...oneDirection,
      directions: [
        {
          ...oneDirection.directions[0],
          scheduledDepartures: ['06:00', '06:00', '06:30'],
        },
      ],
    };
    render(withProvider(<LineScheduleCard data={withDup} />));
    expect(screen.getAllByText('06:00')).toHaveLength(1);
  });
});
