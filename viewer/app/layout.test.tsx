import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// `next/font/google` is a build-time loader; outside `next build` it's
// not a real module. Mock the three font loaders the layout imports so
// the variable className strings are deterministic in tests.
vi.mock('next/font/google', () => {
  const stub = (variableName: string) => () => ({
    className: `__className_${variableName}`,
    variable: `__variable_${variableName}`,
    style: { fontFamily: variableName },
  });
  return {
    Fraunces: stub('fraunces'),
    IBM_Plex_Sans: stub('plex-sans'),
    IBM_Plex_Mono: stub('plex-mono'),
  };
});

// next-intl/server is request-scoped and not available in vitest. Mock
// getLocale + getMessages so the async server-component can resolve and
// we can inspect the rendered tree.
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('es'),
  getMessages: vi.fn().mockResolvedValue({
    chrome: {
      title: 'colonia-gtfs',
      disclaimer: 'Datos preliminares · operador no oficial · tarifas a confirmar',
      themeToggle: 'Cambiar tema',
    },
    landing: { title: 'Viajes en bus', subtitle: 'Próximamente' },
  }),
}));

import RootLayout, { metadata } from './layout';

describe('app/layout.tsx', () => {
  it('R-01 exposes static metadata (title + description)', () => {
    expect(metadata.title).toBe('colonia-gtfs');
    expect(metadata.description).toMatch(/Colonia/);
  });

  it('R-01 renders <html lang> from getLocale + nests children inside chrome', async () => {
    const element = await RootLayout({
      children: <div data-testid="child">slot</div>,
    });
    const markup = renderToStaticMarkup(element);

    // html element carries the resolved locale.
    expect(markup).toMatch(/<html[^>]*lang="es"/);

    // Chrome layer renders both the header title and the disclaimer copy.
    expect(markup).toContain('colonia-gtfs');
    expect(markup).toContain('tarifas a confirmar');

    // Children pass through to <main>.
    expect(markup).toContain('slot');
    expect(markup).toContain('data-testid="child"');

    // Body uses the flex-column layout that pins the disclaimer to the bottom.
    expect(markup).toMatch(/<body[^>]*class="[^"]*flex flex-col/);
  });
});
