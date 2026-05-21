'use client';

import { useTranslations } from 'next-intl';
import { getLineColor } from '@/lib/colors/lines';
import type { RestItinerary } from '@/lib/otp/translate-plan';

function minutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}

function formatFare(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface Props {
  itineraries: RestItinerary[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Optional render-prop: when supplied, the result is rendered as a
   *  panel directly below the SELECTED itinerary row — keeps the
   *  expanded detail visually anchored to its summary card instead of
   *  floating at the end of the list. */
  renderDetail?: (itinerary: RestItinerary, index: number) => React.ReactNode;
}

export function ItineraryOptionsList({
  itineraries,
  selectedIndex,
  onSelect,
  renderDetail,
}: Props): React.ReactElement {
  const t = useTranslations('od.card');

  return (
    <ol data-testid="itinerary-options" className="flex flex-col gap-2">
      {itineraries.map((it, i) => {
        const isSelected = i === selectedIndex;
        const busLegs = it.legs.filter((leg) => leg.mode === 'BUS');
        const walkMeters = Math.round(it.walkDistanceMeters);
        return (
          <li key={i} className="flex flex-col">
            <button
              type="button"
              data-testid={`itinerary-option-${i}`}
              data-selected={isSelected}
              onClick={() => onSelect(i)}
              aria-expanded={isSelected}
              className={[
                'w-full border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                isSelected
                  ? 'rounded-t-md border-b-0 border-primary bg-accent'
                  : 'rounded-md border-border bg-card hover:bg-muted',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg font-semibold tracking-tight">
                  {t('duration', { minutes: minutes(it.durationSeconds) })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('walkDistance', { meters: walkMeters })}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {busLegs.length === 0 ? (
                  <span
                    data-testid={`itinerary-option-${i}-walk-only`}
                    className="text-muted-foreground"
                  >
                    {t('walkOnly')}
                  </span>
                ) : (
                  busLegs.map((leg, j) => {
                    const shortName = leg.route?.shortName ?? '—';
                    return (
                      <span
                        key={j}
                        data-testid={`itinerary-option-${i}-line-${shortName}`}
                        className="rounded-full px-2 py-0.5 font-semibold text-white"
                        style={{ backgroundColor: getLineColor(shortName) }}
                      >
                        {t('lineChip', { shortName })}
                      </span>
                    );
                  })
                )}
                <span className="ml-auto text-muted-foreground">
                  {it.fare
                    ? t('fareValue', { amount: formatFare(it.fare.regular.cents) })
                    : t('fareUnconfirmed')}
                </span>
              </div>
            </button>
            {isSelected && renderDetail && (
              <div
                data-testid={`itinerary-detail-${i}`}
                className="rounded-b-md border border-t-0 border-primary bg-card p-3"
              >
                {renderDetail(it, i)}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
