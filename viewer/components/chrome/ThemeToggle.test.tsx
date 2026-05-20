import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

const messages = {
  chrome: {
    themeToggle: 'Cambiar tema',
  },
};

function renderToggle(initial: 'light' | 'dark' = 'light'): void {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ThemeProvider attribute="class" defaultTheme={initial} enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  // next-themes persists to localStorage; reset between tests so each
  // assertion starts from a clean slate. happy-dom occasionally surfaces
  // `window.localStorage` as undefined under certain CI configurations,
  // so guard the access — the next-themes provider regenerates state
  // from defaultTheme regardless.
  window.localStorage?.clear?.();
  document.documentElement.className = '';
});
afterEach(() => {
  document.documentElement.className = '';
});

describe('ThemeToggle', () => {
  it('R-13 renders an icon-only button with the i18n aria-label', async () => {
    renderToggle('light');
    const btn = await screen.findByRole('button', { name: 'Cambiar tema' });
    expect(btn).toHaveAttribute('data-testid', 'theme-toggle');
  });

  it('R-13 shows the moon icon when the active theme is light', async () => {
    renderToggle('light');
    await waitFor(() => expect(screen.queryByTestId('theme-icon-moon')).not.toBeNull());
    expect(screen.queryByTestId('theme-icon-sun')).toBeNull();
  });

  it('R-13 shows the sun icon when the active theme is dark', async () => {
    renderToggle('dark');
    await waitFor(() => expect(screen.queryByTestId('theme-icon-sun')).not.toBeNull());
    expect(screen.queryByTestId('theme-icon-moon')).toBeNull();
  });

  it('R-13 toggles the theme on click (light → dark → light)', async () => {
    renderToggle('light');
    const btn = await screen.findByTestId('theme-toggle');

    act(() => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    act(() => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
