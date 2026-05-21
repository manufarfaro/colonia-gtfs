import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import esMessages from '@/messages/es.json';
import { makeQueryWrapper } from '@/test/query-test-wrapper';

// Stub all OD primitives so we don't need to mock the Maps SDK here —
// this suite is purely about the server component's wiring of the env
// var into the client shell.
vi.mock('@/components/od/OriginDestinationInputs', () => ({
  OriginDestinationInputs: () => <div data-testid="stub-inputs" />,
}));
vi.mock('@/components/od/MapCanvas', () => ({
  MapCanvas: ({ apiKey }: { apiKey: string }) => (
    <div data-testid="stub-map" data-apikey={apiKey} />
  ),
}));
vi.mock('@/components/od/ItineraryCard', () => ({
  ItineraryCard: () => <div data-testid="stub-card" />,
}));

const previous = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
});
afterEach(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = previous;
});

async function renderPage(): Promise<void> {
  vi.resetModules();
  const HomePage = (await import('./page')).default;
  const { Wrapper } = makeQueryWrapper();
  render(
    <Wrapper>
      <NextIntlClientProvider locale="es" messages={esMessages}>
        {HomePage()}
      </NextIntlClientProvider>
    </Wrapper>,
  );
}

describe('app/page.tsx', () => {
  it('R-01 renders the OD shell with map when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'prod-key';
    await renderPage();
    expect(screen.getByTestId('od-shell')).toBeInTheDocument();
    expect(screen.getByTestId('stub-map').getAttribute('data-apikey')).toBe('prod-key');
    expect(screen.queryByTestId('od-api-key-missing')).not.toBeInTheDocument();
  });

  it('R-02 renders the API-key-missing banner when the env var is unset', async () => {
    await renderPage();
    expect(screen.getByTestId('od-api-key-missing')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-map')).not.toBeInTheDocument();
  });
});
