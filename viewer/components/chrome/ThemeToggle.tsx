'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Single-button theme toggle. Reads the resolved theme (light/dark) from
 * next-themes, paints the *opposite* icon (so the icon hints at "what
 * you'll get if you click"), and flips between the two on click.
 *
 * Renders a stable placeholder until mount to avoid a hydration mismatch:
 * the SSR pass renders without knowing the user's system preference, so
 * we hide the icon swap until after the client has resolved the theme.
 */
export function ThemeToggle(): React.ReactElement {
  const t = useTranslations('chrome');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  function toggle(): void {
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t('themeToggle')}
      data-testid="theme-toggle"
    >
      {mounted ? (
        isDark ? (
          <Sun aria-hidden="true" data-testid="theme-icon-sun" />
        ) : (
          <Moon aria-hidden="true" data-testid="theme-icon-moon" />
        )
      ) : (
        <span aria-hidden="true" data-testid="theme-icon-placeholder" />
      )}
    </Button>
  );
}
