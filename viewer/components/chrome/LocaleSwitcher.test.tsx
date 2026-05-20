import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Each test loads LocaleSwitcher fresh after stubbing the routing module so we
// can exercise both the single-locale (no-op) and the multi-locale branches.
afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/i18n/routing');
});

async function loadWithLocales(locales: readonly string[]): Promise<typeof import('./LocaleSwitcher').LocaleSwitcher> {
  vi.doMock('@/i18n/routing', () => ({
    routing: { locales, defaultLocale: locales[0] },
  }));
  const mod = await import('./LocaleSwitcher');
  return mod.LocaleSwitcher;
}

describe('LocaleSwitcher', () => {
  it('R-02 renders a hidden slot when v0 ships with a single locale', async () => {
    const LocaleSwitcher = await loadWithLocales(['es']);
    render(<LocaleSwitcher />);
    const slot = screen.getByTestId('locale-switcher');
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    expect(slot.getAttribute('role')).toBeNull();
  });

  it('R-02 renders the language switcher group when there are multiple locales', async () => {
    const LocaleSwitcher = await loadWithLocales(['es', 'en']);
    render(<LocaleSwitcher />);
    const slot = screen.getByTestId('locale-switcher');
    expect(slot).toHaveAttribute('role', 'group');
    expect(slot).toHaveAttribute('aria-label', 'Language switcher');
    expect(slot.getAttribute('aria-hidden')).toBeNull();
  });
});
