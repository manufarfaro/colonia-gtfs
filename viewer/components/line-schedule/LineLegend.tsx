'use client';

import { useTranslations } from 'next-intl';
import { getLineColor } from '@/lib/colors/lines';
import type { RestLineResponse } from '@/lib/otp/translate-line';

interface Props {
  data: RestLineResponse;
  activeDirectionId: number;
  onActiveDirectionChange?: (directionId: number) => void;
}

export function LineLegend({
  data,
  activeDirectionId,
  onActiveDirectionChange,
}: Props): React.ReactElement | null {
  const t = useTranslations('od.lineSchedule.legend');
  const line = data.line;
  if (!line) return null;
  const color = getLineColor(line.shortName);
  const active = data.directions.find((d) => d.directionId === activeDirectionId);
  const other = data.directions.find((d) => d.directionId !== activeDirectionId);
  if (!active) return null;

  return (
    <div
      data-testid="line-legend"
      className="absolute left-3 top-3 z-10 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur"
    >
      <div className="mb-1 font-semibold tracking-tight">
        {t('header', { shortName: line.shortName })}
      </div>
      <div data-testid="line-legend-active" className="flex items-center gap-2 py-1">
        <span
          aria-hidden="true"
          className="inline-block h-1 w-8 rounded"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-foreground">
          {t('outbound', { headsign: active.headsign })}
        </span>
      </div>
      {other && (
        <button
          type="button"
          data-testid="line-legend-other"
          onClick={() => onActiveDirectionChange?.(other.directionId)}
          aria-label={t('switchTo', { headsign: other.headsign })}
          className="flex w-full items-center gap-2 py-1 text-left transition-colors hover:bg-muted/60 rounded -mx-1 px-1"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-1 w-8 items-center justify-between"
          >
            <span className="block h-1 w-1.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="block h-1 w-1.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="block h-1 w-1.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="block h-1 w-1.5 rounded-sm" style={{ backgroundColor: color }} />
          </span>
          <span className="flex flex-1 items-center justify-between gap-2 text-muted-foreground">
            <span>{t('inbound', { headsign: other.headsign })}</span>
            <span aria-hidden="true" className="text-[10px] opacity-60">↻</span>
          </span>
        </button>
      )}
    </div>
  );
}
