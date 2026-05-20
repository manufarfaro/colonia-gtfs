import { defineRouting } from 'next-intl/routing';

/**
 * v0 locales: Spanish only. Adding `en` / `pt` later is additive — drop
 * the message file under `messages/<locale>.json` and append the locale
 * here. No component code change required.
 */
export const routing = defineRouting({
  locales: ['es'],
  defaultLocale: 'es',
});
