'use client';

import { useState } from 'react';
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
  // `data.directions[0]` is guaranteed by the shell's mounting guard;
  // the `?? 0` is purely a TypeScript defensive fallback.
  /* v8 ignore next */
  const [activeDir, setActiveDir] = useState<number>(data.directions[0]?.directionId ?? 0);
  const showTabs = data.directions.length > 1;
  // Same guarantee — find() always hits the activeDir entry since the
  // user can only switch to tabs we render.
  /* v8 ignore next */
  const active = data.directions.find((d) => d.directionId === activeDir) ?? data.directions[0];
  const line = data.line!;

  return (
    <section data-testid="line-schedule-card">
      <header data-testid="line-card-header" className="flex items-baseline justify-between pb-2">
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
                activeDir === dir.directionId ? 'border-b-2 border-foreground font-medium' : 'text-muted-foreground'
              }`}
              onClick={() => setActiveDir(dir.directionId)}
            >
              {dir.headsign}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-[1fr_2fr]">
          <ul aria-label="stops" className="space-y-1">
            {active.stops.map((stop) => (
              <li key={stop.id}>
                <button
                  type="button"
                  onClick={() => onStopClick(stop.id)}
                  className="text-left text-foreground underline-offset-2 hover:underline"
                >
                  {stop.name}
                </button>
              </li>
            ))}
          </ul>
          <ul aria-label="departures" className="flex flex-wrap gap-2">
            {active.scheduledDepartures.map((time) => (
              <li key={time} className="rounded-md border border-border px-2 py-0.5 text-xs">
                {time}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
