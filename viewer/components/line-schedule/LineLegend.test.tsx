import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import esMessages from '@/messages/es.json';
import type { RestLineResponse } from '@/lib/otp/translate-line';
import { LineLegend } from './LineLegend';

function withData(overrides: Partial<RestLineResponse> = {}): RestLineResponse {
  return {
    line: { id: '1:4', shortName: '4', longName: 'L4' },
    shape: [],
    directions: [
      {
        directionId: 0,
        headsign: 'El General',
        stops: [],
        scheduledDepartures: [],
      },
      {
        directionId: 1,
        headsign: 'Centro',
        stops: [],
        scheduledDepartures: [],
      },
    ],
    meta: { date: '2026-05-21' },
    ...overrides,
  };
}

function renderLegend(data: RestLineResponse): void {
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <LineLegend data={data} />
    </NextIntlClientProvider>,
  );
}

describe('LineLegend', () => {
  it('renders nothing when line is null', () => {
    const { container } = render(
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <LineLegend data={withData({ line: null })} />
      </NextIntlClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the line short name in the header', () => {
    renderLegend(withData());
    expect(screen.getByTestId('line-legend')).toBeInTheDocument();
    expect(screen.getByText(/Línea 4/)).toBeInTheDocument();
  });

  it('renders the outbound row with the direction 0 headsign', () => {
    renderLegend(withData());
    const row = screen.getByTestId('line-legend-outbound');
    expect(row.textContent).toContain('Ida');
    expect(row.textContent).toContain('El General');
  });

  it('renders the inbound row with the direction 1 headsign', () => {
    renderLegend(withData());
    const row = screen.getByTestId('line-legend-inbound');
    expect(row.textContent).toContain('Vuelta');
    expect(row.textContent).toContain('Centro');
  });

  it('omits the outbound row when there is no direction 0', () => {
    const onlyInbound = withData({
      directions: [
        { directionId: 1, headsign: 'Centro', stops: [], scheduledDepartures: [] },
      ],
    });
    renderLegend(onlyInbound);
    expect(screen.queryByTestId('line-legend-outbound')).toBeNull();
    expect(screen.getByTestId('line-legend-inbound')).toBeInTheDocument();
  });

  it('omits the inbound row when there is no direction 1', () => {
    const onlyOutbound = withData({
      directions: [
        { directionId: 0, headsign: 'El General', stops: [], scheduledDepartures: [] },
      ],
    });
    renderLegend(onlyOutbound);
    expect(screen.getByTestId('line-legend-outbound')).toBeInTheDocument();
    expect(screen.queryByTestId('line-legend-inbound')).toBeNull();
  });
});
