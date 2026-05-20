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
      <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between px-4">
        <span className="text-sm font-semibold tracking-tight">{t('title')}</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
