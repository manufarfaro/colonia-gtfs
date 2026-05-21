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

function renderLegend(data: RestLineResponse, activeDirectionId = 0): void {
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <LineLegend data={data} activeDirectionId={activeDirectionId} />
    </NextIntlClientProvider>,
  );
}

describe('LineLegend', () => {
  it('renders nothing when line is null', () => {
    const { container } = render(
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <LineLegend data={withData({ line: null })} activeDirectionId={0} />
      </NextIntlClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the active direction is not in the data', () => {
    const { container } = render(
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <LineLegend data={withData()} activeDirectionId={99} />
      </NextIntlClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the line short name in the header', () => {
    renderLegend(withData(), 0);
    expect(screen.getByTestId('line-legend')).toBeInTheDocument();
    expect(screen.getByText(/Línea 4/)).toBeInTheDocument();
  });

  it('renders the active direction 0 as the solid (ida) row when direction 0 is active', () => {
    renderLegend(withData(), 0);
    const active = screen.getByTestId('line-legend-active');
    expect(active.textContent).toContain('Ida');
    expect(active.textContent).toContain('El General');
    const other = screen.getByTestId('line-legend-other');
    expect(other.textContent).toContain('Vuelta');
    expect(other.textContent).toContain('Centro');
  });

  it('swaps active + other rows when direction 1 is active', () => {
    renderLegend(withData(), 1);
    const active = screen.getByTestId('line-legend-active');
    expect(active.textContent).toContain('Centro');
    const other = screen.getByTestId('line-legend-other');
    expect(other.textContent).toContain('El General');
  });

  it('omits the other row when only one direction exists', () => {
    const oneDir = withData({
      directions: [
        { directionId: 0, headsign: 'Solo', stops: [], scheduledDepartures: [] },
      ],
    });
    renderLegend(oneDir, 0);
    expect(screen.getByTestId('line-legend-active')).toBeInTheDocument();
    expect(screen.queryByTestId('line-legend-other')).toBeNull();
  });
});
