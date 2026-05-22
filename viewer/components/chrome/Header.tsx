'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function Header(): React.ReactElement {
  const t = useTranslations('chrome');
  return (
    <header className="sticky top-0 z-50 bg-[#0084fc] text-white">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Image
            src="/colonia-logo.png"
            alt={t('logoAlt')}
            width={842}
            height={228}
            priority
            className="h-9 w-auto"
          />
          <span
            data-testid="chrome-title"
            className="font-display text-base font-semibold tracking-tight"
          >
            {t('title')}
          </span>
        </div>
        <div className="flex items-center gap-1 [&_button]:text-white [&_button]:hover:bg-white/15 [&_button]:hover:text-white">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
