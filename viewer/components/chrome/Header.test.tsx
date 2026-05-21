import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

const messages = {
  chrome: {
    title: 'Maps',
    logoAlt: 'Intendencia de Colonia',
    themeToggle: 'Cambiar tema',
  },
};

function renderWithProvider(): void {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <Header />
    </NextIntlClientProvider>,
  );
}

describe('Header', () => {
  it('R-02 renders the branded title from the i18n catalog', () => {
    renderWithProvider();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Maps')).toBeInTheDocument();
  });

  it('R-02 renders the Intendencia logo with the localized alt text', () => {
    renderWithProvider();
    const logo = screen.getByRole('img', { name: 'Intendencia de Colonia' });
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toContain('colonia-logo.png');
  });

  it('R-02 includes a LocaleSwitcher slot', () => {
    renderWithProvider();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('R-02 is sticky to the top via Tailwind classes', () => {
    renderWithProvider();
    const banner = screen.getByRole('banner');
    expect(banner.className).toContain('sticky');
    expect(banner.className).toContain('top-0');
  });

  it('R-02 title is rendered with the display font', () => {
    renderWithProvider();
    const title = screen.getByTestId('chrome-title');
    expect(title.className).toContain('font-display');
    expect(title.textContent).toBe('Maps');
  });
});
