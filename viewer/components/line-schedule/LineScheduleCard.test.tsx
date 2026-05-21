import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
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
        { id: 'sol-antigua:1', name: 'Terminal', lat: 0, lon: 0 },
        { id: 'sol-antigua:2', name: 'Plaza Mayor', lat: 0, lon: 0 },
      ],
      scheduledDepartures: ['06:00', '06:30', '07:00'],
    },
    {
      directionId: 1,
      headsign: 'Real de San Carlos',
      stops: [{ id: 'sol-antigua:2', name: 'Plaza Mayor', lat: 0, lon: 0 }],
      scheduledDepartures: ['06:30', '07:00'],
    },
  ],
  meta: { date: '2026-05-20' },
};

const oneDirection: RestLineResponse = {
  ...twoDirections,
  directions: [twoDirections.directions[0]],
};

describe('LineScheduleCard', () => {
  it('R-03 renders the line shortName + longName in the header', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} onStopClick={() => {}} />));
    expect(screen.getByTestId('line-card-header').textContent).toContain('Línea 4');
    expect(screen.getByTestId('line-card-header').textContent).toContain('Real de San Carlos');
  });

  it('R-03 renders a tab per direction', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} onStopClick={() => {}} />));
    expect(screen.getByTestId('line-tab-0').textContent).toContain('Centro');
    expect(screen.getByTestId('line-tab-1').textContent).toContain('Real de San Carlos');
  });

  it('R-03 defaults to directionId 0 selected', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} onStopClick={() => {}} />));
    expect(screen.getByTestId('line-tab-0').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('line-tab-1').getAttribute('aria-selected')).toBe('false');
    // The default-selected direction's departures are visible.
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });

  it('R-03 switching tabs swaps the visible departures', () => {
    render(withProvider(<LineScheduleCard data={twoDirections} onStopClick={() => {}} />));
    fireEvent.click(screen.getByTestId('line-tab-1'));
    expect(screen.getByTestId('line-tab-1').getAttribute('aria-selected')).toBe('true');
    // Direction 1's departures (no "06:00").
    expect(screen.queryByText('06:00')).not.toBeInTheDocument();
    expect(screen.getByText('06:30')).toBeInTheDocument();
  });

  it('R-03 single-direction lines render no tab bar', () => {
    render(withProvider(<LineScheduleCard data={oneDirection} onStopClick={() => {}} />));
    expect(screen.queryByTestId('line-tabs')).not.toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });

  it('R-03 tap on a stop fires onStopClick with the stop id', () => {
    const onStopClick = vi.fn();
    render(withProvider(<LineScheduleCard data={twoDirections} onStopClick={onStopClick} />));
    fireEvent.click(screen.getByText('Terminal'));
    expect(onStopClick).toHaveBeenCalledWith('sol-antigua:1');
  });
});
