import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import { StopInfoCard } from './StopInfoCard';
import type { ArrivalsResponse, ArrivalsState } from './useArrivalsQuery';

function withProvider(ui: React.ReactElement): React.ReactElement {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

const baseSuccess: Extract<ArrivalsState, { state: 'success' }> = {
  state: 'success',
  data: {
    stop: { id: 'sol-antigua:3', name: 'INT SUAREZ', lat: -34.47, lon: -57.85 },
    arrivals: [
      {
        lineShortName: '4',
        headsign: 'Centro',
        // 4 minutes after the now passed to the card.
        scheduledArrivalIso: '2026-05-20T14:34:00Z',
        realtimeArrivalIso: '2026-05-20T14:34:30Z',
        isRealtime: true,
        delaySeconds: 30,
      },
      {
        lineShortName: '5',
        headsign: 'El General',
        // 12 minutes after now.
        scheduledArrivalIso: '2026-05-20T14:42:00Z',
        realtimeArrivalIso: null,
        isRealtime: false,
        delaySeconds: 0,
      },
    ],
    meta: { queriedAt: '2026-05-20T14:30:00Z', realtime_available: true },
  } as ArrivalsResponse,
  error: null,
};

const now = new Date('2026-05-20T14:30:00Z');

describe('StopInfoCard', () => {
  it('R-02 renders the stop name in the header', () => {
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getByTestId('stop-info-header').textContent).toContain('INT SUAREZ');
  });

  it('R-02 renders one row per arrival', () => {
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    const rows = screen.getAllByTestId(/^arrival-row-/);
    expect(rows).toHaveLength(2);
  });

  it('R-02 realtime row shows the "En vivo" badge', () => {
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    const liveBadge = screen.getAllByTestId('arrival-badge-live');
    expect(liveBadge.length).toBe(1);
    expect(liveBadge[0].textContent).toContain('En vivo');
  });

  it('R-02 scheduled row carries the "(horario)" suffix', () => {
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    const scheduledBadge = screen.getAllByTestId('arrival-badge-scheduled');
    expect(scheduledBadge.length).toBe(1);
    expect(scheduledBadge[0].textContent).toContain('(horario)');
  });

  it('R-03 ETA shows minutes for arrivals within 30 minutes (realtime ISO when available)', () => {
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    const rows = screen.getAllByTestId(/^arrival-row-/);
    // realtime arrival is 14:34:30 → 4m30s → rounded up to 5 min.
    expect(rows[0].textContent).toContain('en 5 min');
    // scheduled-only arrival is 14:42:00 → 12 min exactly.
    expect(rows[1].textContent).toContain('en 12 min');
  });

  it('R-02 shows "Línea N" + headsign in each row', () => {
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    const rows = screen.getAllByTestId(/^arrival-row-/);
    expect(rows[0].textContent).toContain('Línea 4');
    expect(rows[0].textContent).toContain('Centro');
    expect(rows[1].textContent).toContain('Línea 5');
    expect(rows[1].textContent).toContain('El General');
  });

  it('R-04 loading state renders the catalog message', () => {
    const loadingState: ArrivalsState = { state: 'loading', data: null, error: null };
    render(withProvider(<StopInfoCard state={loadingState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getByText(/Cargando próximas llegadas/)).toBeInTheDocument();
  });

  it('R-04 error.empty state renders the empty message', () => {
    const errorState: ArrivalsState = { state: 'error', data: null, error: 'empty' };
    render(withProvider(<StopInfoCard state={errorState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getByText(/No hay próximos buses/)).toBeInTheDocument();
  });

  it('R-04 error.otp_unavailable renders the OTP message', () => {
    const errorState: ArrivalsState = { state: 'error', data: null, error: 'otp_unavailable' };
    render(withProvider(<StopInfoCard state={errorState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getByText(/servicio de información de paradas no está disponible/)).toBeInTheDocument();
  });

  it('R-04 error.not_found renders message + return button that fires onReturnHome', () => {
    const errorState: ArrivalsState = { state: 'error', data: null, error: 'not_found' };
    const onReturnHome = vi.fn();
    render(withProvider(<StopInfoCard state={errorState} now={now} onClose={() => {}} onReturnHome={onReturnHome} />));
    expect(screen.getByText(/Esta parada no existe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it('R-04 error.network renders the network message', () => {
    const errorState: ArrivalsState = { state: 'error', data: null, error: 'network' };
    render(withProvider(<StopInfoCard state={errorState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getByText(/No pudimos conectarnos/)).toBeInTheDocument();
  });

  it('R-04 idle state renders nothing visible (deferred to parent)', () => {
    const idleState: ArrivalsState = { state: 'idle', data: null, error: null };
    const { container } = render(withProvider(<StopInfoCard state={idleState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(container.textContent).toBe('');
  });

  it('R-03 absolute ETA renders for arrivals beyond 30 minutes', () => {
    const farState: Extract<ArrivalsState, { state: 'success' }> = {
      state: 'success',
      data: {
        ...baseSuccess.data,
        arrivals: [
          {
            lineShortName: '8',
            headsign: 'Algodones',
            scheduledArrivalIso: '2026-05-20T16:30:00Z',
            realtimeArrivalIso: null,
            isRealtime: false,
            delaySeconds: 0,
          },
        ],
      } as ArrivalsResponse,
      error: null,
    };
    render(withProvider(<StopInfoCard state={farState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getAllByTestId(/^arrival-row-/)[0].textContent).toContain('a las 13:30');
  });

  it('R-03 "Ahora" ETA renders for arrivals at or just before now', () => {
    const nowState: Extract<ArrivalsState, { state: 'success' }> = {
      state: 'success',
      data: {
        ...baseSuccess.data,
        arrivals: [
          {
            lineShortName: '4',
            headsign: 'Centro',
            scheduledArrivalIso: '2026-05-20T14:30:00Z',
            realtimeArrivalIso: '2026-05-20T14:30:00Z',
            isRealtime: true,
            delaySeconds: 0,
          },
        ],
      } as ArrivalsResponse,
      error: null,
    };
    render(withProvider(<StopInfoCard state={nowState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getAllByTestId(/^arrival-row-/)[0].textContent).toContain('Ahora');
  });

  it('R-03 "Pasó hace" ETA renders for arrivals already past', () => {
    const pastState: Extract<ArrivalsState, { state: 'success' }> = {
      state: 'success',
      data: {
        ...baseSuccess.data,
        arrivals: [
          {
            lineShortName: '4',
            headsign: 'Centro',
            // 3 minutes before "now".
            scheduledArrivalIso: '2026-05-20T14:27:00Z',
            realtimeArrivalIso: null,
            isRealtime: false,
            delaySeconds: 0,
          },
        ],
      } as ArrivalsResponse,
      error: null,
    };
    render(withProvider(<StopInfoCard state={pastState} now={now} onClose={() => {}} onReturnHome={() => {}} />));
    expect(screen.getAllByTestId(/^arrival-row-/)[0].textContent).toContain('Pasó hace 3 min');
  });

  it('R-02 close button fires onClose', () => {
    const onClose = vi.fn();
    render(withProvider(<StopInfoCard state={baseSuccess} now={now} onClose={onClose} onReturnHome={() => {}} />));
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
