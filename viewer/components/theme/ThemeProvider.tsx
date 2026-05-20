'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

/**
 * Thin wrapper around next-themes' provider. Defaults match the
 * "system preference on first load, persisted by user toggle" UX:
 *   - attribute='class'   → toggles `class="dark"` on <html> (Tailwind v4
 *                            picks it up via the @custom-variant in globals.css)
 *   - defaultTheme='system'
 *   - enableSystem        → honor prefers-color-scheme on initial render
 *   - disableTransitionOnChange → no flicker when switching themes
 *
 * The defaults can be overridden per-instance — e.g. tests force a
 * known theme to avoid flakes against the host OS preference.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps): React.ReactElement {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
