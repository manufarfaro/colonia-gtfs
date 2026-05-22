import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import { makeQueryWrapper } from '@/test/query-test-wrapper';

// Stub the child components so this suite focuses on composition + the
// state-driven bottom sheet branches.
vi.mock('./OriginDestinationInputs', () => ({
  OriginDestinationInputs({
    onChange,
  }: {
    onChange: (change: { from: unknown; to: unknown }) => void;
  }): React.ReactElement {
    return (
      <button
        data-testid="stub-select-both"
        onClick={() =>
          onChange({ from: { lat: -34.471, lon: -57.852 }, to: { lat: -34.449, lon: -57.815 } })
        }
      >
        select-both
      </button>
    );
  },
}));
vi.mock('./MapCanvas', () => ({
  MapCanvas: ({
    onStopClick,
  }: {
    onStopClick?: (id: string) => void;
  }) => (
    <div data-testid="stub-map">
      <button
        data-testid="stub-stop-click"
        onClick={() => onStopClick?.('sol-antigua:3')}
      >
        click stop
      </button>
    </div>
  ),
}));
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ apiKey, children }: { apiKey: string; children: React.ReactNode }) => (
    <div data-testid="stub-api-provider" data-apikey={apiKey}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/stop-info/StopInfoCard', () => ({
  StopInfoCard: ({
    state,
    onReturnHome,
  }: {
    state: { state: string; error?: string };
    onReturnHome: () => void;
  }) => (
    <div data-testid="stub-stop-info-card" data-state={state.state}>
      <button data-testid="stub-return-home" onClick={onReturnHome}>
        return-home
      </button>
    </div>
  ),
}));
vi.mock('./ItineraryCard', () => ({
  ItineraryCard: () => <div data-testid="stub-card" />,
}));
vi.mock('@/components/line-schedule/LineSelector', () => ({
  LineSelector: ({ onPickLine }: { onPickLine: (s: string) => void }) => (
    <button data-testid="stub-line-pick-4" onClick={() => onPickLine('4')}>pick</button>
  ),
}));
vi.mock('@/components/line-schedule/LineScheduleCard', () => ({
  LineScheduleCard: ({
    data,
  }: {
    data: { line: { shortName: string } | null };
  }) => (
    <div data-testid="stub-line-card" data-shortname={data.line?.shortName ?? ''} />
  ),
}));

import { OdModeShell } from './OdModeShell';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderShell(apiKey: string | undefined): void {
  // Reset hash before each render so tests start in OD mode.
  window.history.replaceState(null, '', '/');
  const { Wrapper: QueryWrapper } = makeQueryWrapper();
  render(
    <QueryWrapper>
      <NextIntlClientProvider locale="es" messages={esMessages}>
        <OdModeShell apiKey={apiKey} />
      </NextIntlClientProvider>
    </QueryWrapper>,
  );
}

describe('OdModeShell', () => {
  it('R-01 renders the OD shell with search slot + map slot when the API key is present', () => {
    renderShell('test-key');
    expect(screen.getByTestId('od-shell')).toBeInTheDocument();
    expect(screen.getByTestId('od-search-slot')).toBeInTheDocument();
    expect(screen.getByTestId('od-map-slot')).toBeInTheDocument();
    expect(screen.getByTestId('stub-api-provider').getAttribute('data-apikey')).toBe('test-key');
    expect(screen.queryByTestId('od-api-key-missing')).not.toBeInTheDocument();
  });

  it('R-02 renders the API-key-missing banner when the key is undefined', () => {
    renderShell(undefined);
    expect(screen.getByTestId('od-api-key-missing')).toBeInTheDocument();
    expect(screen.getByText(/Falta configurar la API key/)).toBeInTheDocument();
    expect(screen.queryByTestId('od-map-slot')).not.toBeInTheDocument();
  });

  it('R-06 shows the idle hint copy when neither endpoint is picked', () => {
    renderShell('test-key');
    expect(screen.getByTestId('od-state-idle')).toBeInTheDocument();
    expect(screen.getAllByText(/Elegí origen y destino/).length).toBeGreaterThan(0);
  });

  it('R-06 shows the loading label once both endpoints are picked', async () => {
    // Never-resolving fetch keeps the state in loading.
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    renderShell('test-key');
    screen.getAllByTestId('stub-select-both')[0].click();
    await waitFor(() => expect(screen.queryByTestId('od-state-loading')).not.toBeNull());
  });

  it('R-06 surfaces the OTP error copy on a 502 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    renderShell('test-key');
    screen.getAllByTestId('stub-select-both')[0].click();
    await waitFor(() => expect(screen.queryByTestId('od-state-error-otp_unavailable')).not.toBeNull());
    expect(screen.getAllByText(/servicio de planificación no está disponible/).length).toBeGreaterThan(0);
  });

  it('R-06 surfaces the invalid-request copy on a 400 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_request' }, 400));
    renderShell('test-key');
    screen.getAllByTestId('stub-select-both')[0].click();
    await waitFor(() => expect(screen.queryByTestId('od-state-error-invalid_request')).not.toBeNull());
  });

  it('R-06 surfaces the empty-results copy on a 200 with no itineraries', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [] }));
    renderShell('test-key');
    screen.getAllByTestId('stub-select-both')[0].click();
    await waitFor(() => expect(screen.queryByTestId('od-state-error-empty')).not.toBeNull());
  });

  it('R-05 mounts the itinerary card on a successful response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ itineraries: [{ durationSeconds: 1, walkDistanceMeters: 0, fare: null, legs: [] }] }),
    );
    renderShell('test-key');
    screen.getAllByTestId('stub-select-both')[0].click();
    await waitFor(() => expect(screen.queryAllByTestId('stub-card').length).toBeGreaterThan(0));
  });

  it('R-02 tap-on-stop activates the stop-info mode + hides OD inputs', async () => {
    // Arrivals query mounts a fetch — give it an empty stub so the card doesn't crash.
    fetchMock.mockResolvedValue(jsonResponse({ stop: { id: 'sol-antigua:3', name: 'X', lat: 0, lon: 0 }, arrivals: [], meta: { queriedAt: '2026-05-20T14:30:00Z', realtime_available: false } }));
    renderShell('test-key');
    expect(screen.queryByTestId('stub-stop-info-card')).toBeNull();
    act(() => {
      fireEvent.click(screen.getByTestId('stub-stop-click'));
    });
    await waitFor(() => expect(screen.queryByTestId('stub-stop-info-card')).not.toBeNull());
    // The hash now reflects the stop.
    expect(window.location.hash).toBe('#stop=sol-antigua%3A3');
    // OD inputs are hidden when the mode is stop-info.
    expect(screen.queryAllByTestId('stub-select-both')).toHaveLength(0);
  });

  it('R-02 deep-link initial hash drives the initial mode', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stop: { id: 'sol-antigua:3', name: 'X', lat: 0, lon: 0 }, arrivals: [], meta: { queriedAt: '2026-05-20T14:30:00Z', realtime_available: false } }));
    window.history.replaceState(null, '', '#stop=sol-antigua:3');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryByTestId('stub-stop-info-card')).not.toBeNull());
    expect(screen.queryAllByTestId('stub-select-both')).toHaveLength(0);
  });

  it('R-04 onReturnHome forces mode to OD (not_found recovery path)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stop: { id: 'sol-antigua:3', name: 'X', lat: 0, lon: 0 }, arrivals: [], meta: { queriedAt: '2026-05-20T14:30:00Z', realtime_available: false } }));
    renderShell('test-key');
    act(() => {
      fireEvent.click(screen.getByTestId('stub-stop-click'));
    });
    await waitFor(() => expect(screen.queryByTestId('stub-stop-info-card')).not.toBeNull());
    act(() => {
      fireEvent.click(screen.getByTestId('stub-return-home'));
    });
    await waitFor(() => expect(screen.queryByTestId('stub-stop-info-card')).toBeNull());
    expect(window.location.hash).toBe('');
  });

  it('R-01 OD mode shows the "Líneas" entry button + clicking it activates line-schedule', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      line: { id: '1:3', shortName: '3', longName: 'L3' },
      shape: [],
      directions: [],
      meta: { date: '2026-05-20' },
    }));
    fetchMock.mockResolvedValue(jsonResponse({ lineId: '3', vehicles: [], meta: { realtime_available: false, feed_timestamp: null } }));
    renderShell('test-key');
    expect(screen.getByTestId('open-line-selector')).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByTestId('open-line-selector'));
    });
    await waitFor(() => expect(screen.queryAllByTestId('stub-line-card').length).toBeGreaterThan(0));
    expect(window.location.hash).toBe('#line=3');
  });

  it('R-01 LineSelector onPickLine in line-schedule mode switches lines', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      line: { id: '1:5', shortName: '5', longName: 'L5' },
      shape: [],
      directions: [],
      meta: { date: '2026-05-20' },
    }));
    window.history.replaceState(null, '', '#line=5');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryAllByTestId('stub-line-pick-4')[0]).not.toBeNull());
    act(() => {
      fireEvent.click(screen.getAllByTestId('stub-line-pick-4')[0]);
    });
    // The mocked selector picks line 4; the hook updates the hash.
    await waitFor(() => expect(window.location.hash).toBe('#line=4'));
  });

  it('R-02 line-schedule mode hides OD inputs and shows the selector', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      line: { id: '1:4', shortName: '4', longName: 'L4' },
      shape: [],
      directions: [],
      meta: { date: '2026-05-20' },
    }));
    window.history.replaceState(null, '', '#line=4');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryAllByTestId('stub-line-pick-4')[0]).not.toBeNull());
    expect(screen.queryAllByTestId('stub-select-both')).toHaveLength(0);
  });

  it('R-02 line-schedule loading state surfaces the localised copy', async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    window.history.replaceState(null, '', '#line=4');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryByTestId('line-state-loading')).not.toBeNull());
  });

  it('R-02 line-schedule error.not_found surfaces the localised copy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'line_not_found' }, 404));
    window.history.replaceState(null, '', '#line=missing');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryByTestId('line-state-error-not_found')).not.toBeNull());
  });

  it('R-02 line-schedule error.otp surfaces the localised copy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    window.history.replaceState(null, '', '#line=4');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryByTestId('line-state-error-otp_unavailable')).not.toBeNull());
  });

  it('R-02 exit-line-selector returns to OD', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      line: { id: '1:4', shortName: '4', longName: 'L4' },
      shape: [],
      directions: [],
      meta: { date: '2026-05-20' },
    }));
    window.history.replaceState(null, '', '#line=4');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryByTestId('exit-line-selector')).not.toBeNull());
    act(() => {
      fireEvent.click(screen.getByTestId('exit-line-selector'));
    });
    await waitFor(() => expect(window.location.hash).toBe(''));
  });

  it('R-02 line:null in success body surfaces not_found message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      line: null,
      shape: [],
      directions: [],
      meta: { date: '2026-05-20' },
    }));
    window.history.replaceState(null, '', '#line=8');
    const { Wrapper: __QW } = makeQueryWrapper();
    render(
      <__QW>
        <NextIntlClientProvider locale="es" messages={esMessages}>
          <OdModeShell apiKey="test-key" />
        </NextIntlClientProvider>
      </__QW>,
    );
    await waitFor(() => expect(screen.queryByTestId('line-state-error-not_found')).not.toBeNull());
  });

  it('R-02 backdrop click closes the stop-info sheet + returns to OD', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stop: { id: 'sol-antigua:3', name: 'X', lat: 0, lon: 0 }, arrivals: [], meta: { queriedAt: '2026-05-20T14:30:00Z', realtime_available: false } }));
    renderShell('test-key');
    act(() => {
      fireEvent.click(screen.getByTestId('stub-stop-click'));
    });
    await waitFor(() => expect(screen.queryByTestId('stub-stop-info-card')).not.toBeNull());
    act(() => {
      fireEvent.click(screen.getByTestId('bottom-sheet-backdrop'));
    });
    await waitFor(() => expect(screen.queryByTestId('stub-stop-info-card')).toBeNull());
    expect(window.location.hash).toBe('');
    // OD inputs back.
    expect(screen.queryAllByTestId('stub-select-both').length).toBeGreaterThan(0);
  });
});
