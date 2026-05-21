'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { RestLineResponse } from '@/lib/otp/translate-line';

/**
 * The card is only mounted when the shell has confirmed `data.line` is
 * non-null (line-found response) and there is at least one direction.
 * Those preconditions are guarded by the parent so the card's render
 * code can assume them.
 */
export function LineScheduleCard({
  data,
  onStopClick,
}: {
  data: RestLineResponse;
  onStopClick: (stopId: string) => void;
}): React.ReactElement {
  const t = useTranslations('od.lineSchedule.card');
  /* v8 ignore next */
  const [activeDir, setActiveDir] = useState<number>(data.directions[0]?.directionId ?? 0);
  const showTabs = data.directions.length > 1;
  /* v8 ignore next */
  const active = data.directions.find((d) => d.directionId === activeDir) ?? data.directions[0];
  const line = data.line!;

  const uniqueDepartures = useMemo(
    () => Array.from(new Set(active.scheduledDepartures)),
    [active.scheduledDepartures],
  );

  return (
    <section data-testid="line-schedule-card" className="flex flex-col gap-4">
      <header data-testid="line-card-header" className="flex items-baseline justify-between">
        <span className="text-lg font-semibold tracking-tight">{`Línea ${line.shortName}`}</span>
        <span className="text-xs text-muted-foreground">{line.longName}</span>
      </header>

      {showTabs && (
        <div data-testid="line-tabs" role="tablist" className="flex gap-2 border-b border-border pb-2">
          {data.directions.map((dir) => (
            <button
              key={dir.directionId}
              type="button"
              data-testid={`line-tab-${dir.directionId}`}
              role="tab"
              aria-selected={activeDir === dir.directionId}
              className={`px-3 py-1 text-sm ${
                activeDir === dir.directionId
                  ? 'border-b-2 border-foreground font-medium'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setActiveDir(dir.directionId)}
            >
              {dir.headsign}
            </button>
          ))}
        </div>
      )}

      <section data-testid="line-stops-section">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('stopsHeader', { count: active.stops.length })}
        </h3>
        <ol aria-label="stops" className="flex flex-col gap-1 text-sm">
          {active.stops.map((stop, i) => (
            <li key={stop.id} className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => onStopClick(stop.id)}
                className="text-left text-foreground underline-offset-2 hover:underline"
              >
                {stop.name}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section data-testid="line-departures-section">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('departuresHeader', { count: uniqueDepartures.length })}
        </h3>
        <ul aria-label="departures" className="flex flex-wrap gap-1.5">
          {uniqueDepartures.map((time) => (
            <li
              key={time}
              className="rounded-md border border-border px-2 py-0.5 font-mono text-xs tabular-nums"
            >
              {time}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
