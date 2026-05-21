'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getLineColor } from '@/lib/colors/lines';
import {
  closestDepartureIndex,
  minutesSinceMidnightMVD,
  nextArrivalAtStop,
} from '@/lib/time/schedule';
import { computeStopArrivals } from '@/lib/time/stop-arrivals';
import type { RestLineResponse } from '@/lib/otp/translate-line';

export function LineScheduleCard({
  data,
  onActiveDirectionChange,
  selectedStopId,
  onSelectedStopChange,
}: {
  data: RestLineResponse;
  onActiveDirectionChange?: (directionId: number) => void;
  /** Externally-driven selection (e.g., the user clicked a stop dot on
   *  the map). When set, the matching row expands + scrolls into view
   *  with line-color emphasis. */
  selectedStopId?: string | null;
  /** Called when the user toggles a row via the sidebar (so the parent
   *  can keep the map's selection in sync). */
  onSelectedStopChange?: (id: string | null) => void;
}): React.ReactElement {
  const t = useTranslations('od.lineSchedule.card');
  /* v8 ignore next */
  const [activeDir, setActiveDir] = useState<number>(data.directions[0]?.directionId ?? 0);
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null);
  const expandedStopId = selectedStopId !== undefined ? selectedStopId : internalExpanded;
  const setExpandedStopId = useCallback(
    (id: string | null): void => {
      if (onSelectedStopChange) onSelectedStopChange(id);
      else setInternalExpanded(id);
    },
    [onSelectedStopChange],
  );
  const rowRefs = useRef(new Map<string, HTMLLIElement | null>());
  const showTabs = data.directions.length > 1;
  /* v8 ignore next */
  const active = data.directions.find((d) => d.directionId === activeDir) ?? data.directions[0];
  const line = data.line!;
  const color = getLineColor(line.shortName);

  useEffect(() => {
    onActiveDirectionChange?.(activeDir);
  }, [activeDir, onActiveDirectionChange]);

  useEffect(() => {
    if (selectedStopId !== undefined) return;
    setInternalExpanded(null);
  }, [activeDir, selectedStopId]);

  useEffect(() => {
    if (!expandedStopId) return;
    /* v8 ignore start */
    const el = rowRefs.current.get(expandedStopId);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    /* v8 ignore stop */
  }, [expandedStopId]);

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
            const arrivalsAtStop = isExpanded
              ? computeStopArrivals(uniqueDepartures, stop.arrivalOffsetSeconds, nowMinutes)
              : [];
            return (
              <li
                key={stop.id}
                ref={(el) => {
                  rowRefs.current.set(stop.id, el);
                }}
                data-testid={`line-stop-row-${stop.id}`}
                data-selected={isExpanded}
                className={isExpanded ? 'rounded-md border bg-card' : ''}
                style={isExpanded ? { borderColor: color, backgroundColor: `${color}0d` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => setExpandedStopId(isExpanded ? null : stop.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50"
                >
                  <span
                    className="font-mono text-xs tabular-nums w-6"
                    style={isExpanded ? { color } : undefined}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="flex-1 truncate text-foreground"
                    style={isExpanded ? { color, fontWeight: 600 } : undefined}
                  >
                    {stop.name}
                  </span>
                  <span
                    data-testid={`line-stop-eta-${stop.id}`}
                    className="font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    {nextArrival ?? '—'}
                  </span>
                </button>
                {isExpanded && (
                  <div
                    data-testid={`line-stop-detail-${stop.id}`}
                    className="px-3 pb-3 pt-1"
                  >
                    <ol className="flex flex-col gap-0.5 text-xs">
                      {arrivalsAtStop.map((a, idx) => (
                        <li
                          key={`${a.arrivalTime}-${idx}`}
                          data-testid={`line-stop-arrival-${stop.id}-${a.status}`}
                          className="flex items-baseline gap-2 tabular-nums"
                        >
                          <span
                            className="font-mono w-12"
                            style={{
                              color: a.status === 'past' ? 'var(--color-muted-foreground)' : color,
                              opacity: a.status === 'past' ? 0.55 : 1,
                              fontWeight: a.status === 'next' ? 600 : 400,
                            }}
                          >
                            {a.arrivalTime}
                          </span>
                          <span
                            className="text-muted-foreground"
                            style={a.status === 'past' ? { opacity: 0.55 } : undefined}
                          >
                            {a.status === 'past'
                              ? t('arrivalPast', { minutes: Math.abs(a.diffMinutes) })
                              : a.status === 'next'
                                ? t('arrivalNext', { minutes: a.diffMinutes })
                                : t('arrivalFuture', { minutes: a.diffMinutes })}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
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
