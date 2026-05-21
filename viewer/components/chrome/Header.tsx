'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function Header(): React.ReactElement {
  const t = useTranslations('chrome');
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Image
            src="/colonia-logo.png"
            alt={t('logoAlt')}
            width={3248}
            height={1025}
            priority
            className="h-7 w-auto"
          />
          <span
            data-testid="chrome-title"
            className="font-display text-base font-semibold tracking-tight text-foreground"
          >
            {t('title')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
