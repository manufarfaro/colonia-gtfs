'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getLineColor } from '@/lib/colors/lines';
import {
  closestDepartureIndex,
  minutesSinceMidnightMVD,
  nextArrivalAtStop,
} from '@/lib/time/schedule';
import type { RestLineResponse } from '@/lib/otp/translate-line';

export function LineScheduleCard({
  data,
  onActiveDirectionChange,
}: {
  data: RestLineResponse;
  onActiveDirectionChange?: (directionId: number) => void;
}): React.ReactElement {
  const t = useTranslations('od.lineSchedule.card');
  /* v8 ignore next */
  const [activeDir, setActiveDir] = useState<number>(data.directions[0]?.directionId ?? 0);
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const showTabs = data.directions.length > 1;
  /* v8 ignore next */
  const active = data.directions.find((d) => d.directionId === activeDir) ?? data.directions[0];
  const line = data.line!;
  const color = getLineColor(line.shortName);

  useEffect(() => {
    onActiveDirectionChange?.(activeDir);
  }, [activeDir, onActiveDirectionChange]);

  useEffect(() => {
    setExpandedStopId(null);
  }, [activeDir]);

  const uniqueDepartures = useMemo(
    () => Array.from(new Set(active.scheduledDepartures)),
    [active.scheduledDepartures],
  );

  // Wall-clock anchored in Montevideo, ticked once per minute so the
  // "nearest scheduled departure" highlight stays accurate without a
  // dependency on the vehicles poll.
  const [nowMinutes, setNowMinutes] = useState(() => minutesSinceMidnightMVD(new Date()));
  useEffect(() => {
    /* v8 ignore next */
    const t = setInterval(() => setNowMinutes(minutesSinceMidnightMVD(new Date())), 30_000);
    return () => clearInterval(t);
  }, []);

  const closestIdx = closestDepartureIndex(uniqueDepartures, nowMinutes);

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
          {active.stops.map((stop, i) => {
            const nextArrival = nextArrivalAtStop(uniqueDepartures, stop.arrivalOffsetSeconds, nowMinutes);
            const isExpanded = expandedStopId === stop.id;
            return (
              <li key={stop.id} data-testid={`line-stop-row-${stop.id}`}>
                <button
                  type="button"
                  onClick={() => setExpandedStopId(isExpanded ? null : stop.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="font-mono text-xs text-muted-foreground tabular-nums w-6">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 truncate text-foreground">{stop.name}</span>
                  <span
                    data-testid={`line-stop-eta-${stop.id}`}
                    className="font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    {nextArrival ?? '—'}
                  </span>
                </button>
                {isExpanded && (
                  <dl
                    data-testid={`line-stop-detail-${stop.id}`}
                    className="ml-8 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
                  >
                    <dt>ID</dt>
                    <dd className="font-mono tabular-nums">{stop.id}</dd>
                    <dt>{t('stopCoords')}</dt>
                    <dd className="font-mono tabular-nums">
                      {stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}
                    </dd>
                    <dt>{t('stopOffset')}</dt>
                    <dd className="font-mono tabular-nums">
                      +{Math.round(stop.arrivalOffsetSeconds / 60)} min
                    </dd>
                    {nextArrival && (
                      <>
                        <dt>{t('stopNextArrival')}</dt>
                        <dd className="font-mono font-semibold tabular-nums text-foreground">
                          {nextArrival}
                        </dd>
                      </>
                    )}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section data-testid="line-departures-section">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('departuresHeader', { count: uniqueDepartures.length })}
        </h3>
        <ul aria-label="departures" className="flex flex-wrap gap-1.5">
          {uniqueDepartures.map((time, i) => {
            const isClosest = i === closestIdx;
            return (
              <li
                key={time}
                data-testid={isClosest ? 'line-departure-closest' : undefined}
                className={[
                  'rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums transition-colors',
                  isClosest ? 'text-foreground font-medium' : 'border-border',
                ].join(' ')}
                style={
                  isClosest
                    ? { backgroundColor: `${color}1f`, borderColor: color }
                    : undefined
                }
              >
                {time}
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
