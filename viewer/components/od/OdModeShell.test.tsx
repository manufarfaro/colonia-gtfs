import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';

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
  MapCanvas: ({ apiKey }: { apiKey: string }) => <div data-testid="stub-map" data-apikey={apiKey} />,
}));
vi.mock('./ItineraryCard', () => ({
  ItineraryCard: () => <div data-testid="stub-card" />,
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
  render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <OdModeShell apiKey={apiKey} />
    </NextIntlClientProvider>,
  );
}

describe('OdModeShell', () => {
  it('R-01 renders the OD shell with search slot + map slot when the API key is present', () => {
    renderShell('test-key');
    expect(screen.getByTestId('od-shell')).toBeInTheDocument();
    expect(screen.getByTestId('od-search-slot')).toBeInTheDocument();
    expect(screen.getByTestId('od-map-slot')).toBeInTheDocument();
    expect(screen.getByTestId('stub-map').getAttribute('data-apikey')).toBe('test-key');
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
    expect(screen.getByText(/Elegí origen y destino/)).toBeInTheDocument();
  });

  it('R-06 shows the loading label once both endpoints are picked', async () => {
    // Never-resolving fetch keeps the state in loading.
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    renderShell('test-key');
    screen.getByTestId('stub-select-both').click();
    await waitFor(() => expect(screen.queryByTestId('od-state-loading')).not.toBeNull());
  });

  it('R-06 surfaces the OTP error copy on a 502 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    renderShell('test-key');
    screen.getByTestId('stub-select-both').click();
    await waitFor(() => expect(screen.queryByTestId('od-state-error-otp_unavailable')).not.toBeNull());
    expect(screen.getByText(/servicio de planificación no está disponible/)).toBeInTheDocument();
  });

  it('R-06 surfaces the invalid-request copy on a 400 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_request' }, 400));
    renderShell('test-key');
    screen.getByTestId('stub-select-both').click();
    await waitFor(() => expect(screen.queryByTestId('od-state-error-invalid_request')).not.toBeNull());
  });

  it('R-06 surfaces the empty-results copy on a 200 with no itineraries', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [] }));
    renderShell('test-key');
    screen.getByTestId('stub-select-both').click();
    await waitFor(() => expect(screen.queryByTestId('od-state-error-empty')).not.toBeNull());
  });

  it('R-05 mounts the itinerary card on a successful response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ itineraries: [{ durationSeconds: 1, walkDistanceMeters: 0, fare: null, legs: [] }] }),
    );
    renderShell('test-key');
    screen.getByTestId('stub-select-both').click();
    await waitFor(() => expect(screen.queryByTestId('stub-card')).not.toBeNull());
  });
});
