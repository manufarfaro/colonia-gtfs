'use client';

import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

/**
 * Sticky branded header. Hosts the title from the i18n catalog plus the
 * theme toggle and a LocaleSwitcher slot. Persistent across every page
 * (mounted by `app/layout.tsx`).
 */
export function Header(): React.ReactElement {
  const t = useTranslations('chrome');
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        <span
          data-testid="chrome-title"
          className="font-display text-base font-semibold tracking-tight text-foreground"
        >
          {t('title')}
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
