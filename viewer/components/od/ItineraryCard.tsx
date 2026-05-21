'use client';

import { useTranslations } from 'next-intl';
import type { RestItinerary, RestLeg } from '@/lib/otp/translate-plan';

function minutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}

function formatFare(cents: number): string {
  return (cents / 100).toFixed(2);
}

function LegRow({ leg, index }: { leg: RestLeg; index: number }): React.ReactElement {
  const t = useTranslations('od.card');
  const m = minutes(leg.durationSeconds);
  if (leg.mode === 'BUS') {
    // Per the OTP contract, a BUS leg always carries a route — the `?? '—'`
    // is purely a defensive label in case OTP ever surfaces a null route
    // on this mode.
    /* v8 ignore next */
    const shortName = leg.route?.shortName ?? '—';
    return (
      <li data-testid={`itinerary-leg-${index}`}>
        {t('legBus', { shortName, minutes: m, to: leg.to.name })}
      </li>
    );
  }
  return (
    <li data-testid={`itinerary-leg-${index}`}>
      {t('legWalk', { minutes: m, to: leg.to.name })}
    </li>
  );
}

export function ItineraryCard({ itinerary }: { itinerary: RestItinerary }): React.ReactElement {
  const t = useTranslations('od.card');
  const totalMinutes = minutes(itinerary.durationSeconds);
  const walkMeters = Math.round(itinerary.walkDistanceMeters);

  return (
    <section
      data-testid="itinerary-card"
      role="region"
      aria-label="Itinerary"
      className="rounded-t-2xl border-t border-border bg-background p-4 shadow-lg"
    >
      <header className="flex items-baseline justify-between">
        <span data-testid="itinerary-duration" className="text-2xl font-semibold tracking-tight">
          {t('duration', { minutes: totalMinutes })}
        </span>
        <span data-testid="itinerary-walk" className="text-sm text-muted-foreground">
          {t('walkDistance', { meters: walkMeters })}
        </span>
      </header>

      <ol className="mt-3 space-y-1 text-sm">
        {itinerary.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} index={i} />
        ))}
      </ol>

      <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('fare')}</span>
        <span data-testid="itinerary-fare" className="text-sm font-medium">
          {itinerary.fare ? t('fareValue', { amount: formatFare(itinerary.fare.regular.cents) }) : t('fareUnconfirmed')}
        </span>
      </footer>
    </section>
  );
}
