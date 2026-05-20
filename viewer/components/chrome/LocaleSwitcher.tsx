'use client';

import { routing } from '@/i18n/routing';

/**
 * Placeholder LocaleSwitcher. When the v0 ships with a single locale,
 * this renders nothing visually but the slot exists so future locale
 * additions (en, pt) wire components in without re-introducing the
 * structure.
 *
 * The `data-testid` is intentional — tests assert the slot's presence
 * even when it has no visual children.
 */
export function LocaleSwitcher(): React.ReactElement | null {
  if (routing.locales.length === 1) {
    return <div data-testid="locale-switcher" aria-hidden="true" />;
  }
  // Future: render a dropdown / list of locale links.
  return (
    <div data-testid="locale-switcher" role="group" aria-label="Language switcher">
      {/* populated when locales.length > 1 */}
    </div>
  );
}
