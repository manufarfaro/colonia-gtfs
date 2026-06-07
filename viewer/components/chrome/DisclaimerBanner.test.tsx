import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { DisclaimerBanner } from './DisclaimerBanner';

const messages = {
  chrome: {
    disclaimer: 'Datos preliminares · operador no oficial · horarios referenciales',
  },
};

function renderWithProvider(): void {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <DisclaimerBanner />
    </NextIntlClientProvider>,
  );
}

describe('DisclaimerBanner', () => {
  it('R-02 renders the disclaimer text from the i18n catalog', () => {
    renderWithProvider();
    expect(
      screen.getByText('Datos preliminares · operador no oficial · horarios referenciales'),
    ).toBeInTheDocument();
  });

  it('R-02 has no dismiss/close control', () => {
    renderWithProvider();
    // No button at all in the banner — there's nothing to close.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/close|cerrar|dismiss/i)).not.toBeInTheDocument();
  });

  it('R-02 is always visible (no hidden attribute, no display:none)', () => {
    renderWithProvider();
    const banner = screen.getByText(/Datos preliminares/i).closest('[role="region"], div, section');
    expect(banner).not.toBeNull();
    expect(banner!).not.toHaveAttribute('hidden');
    // happy-dom getComputedStyle returns the inline style — assert no display:none.
    if (banner instanceof HTMLElement) {
      expect(banner.style.display).not.toBe('none');
    }
  });
});
