import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

const messages = {
  chrome: {
    title: 'colonia-gtfs',
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
    expect(screen.getByText('colonia-gtfs')).toBeInTheDocument();
  });

  it('R-02 includes a LocaleSwitcher slot', () => {
    renderWithProvider();
    // The slot is rendered as a placeholder when only one locale is available.
    // We assert by data-testid so the slot's existence is verifiable even
    // when it renders nothing visually.
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('R-02 is sticky to the top via Tailwind classes', () => {
    renderWithProvider();
    const banner = screen.getByRole('banner');
    expect(banner.className).toContain('sticky');
    expect(banner.className).toContain('top-0');
  });
});
