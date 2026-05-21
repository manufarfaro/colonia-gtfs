'use client';

import { useTranslations } from 'next-intl';
import { getLineColor } from '@/lib/colors/lines';
import type { RestLineResponse } from '@/lib/otp/translate-line';

interface Props {
  data: RestLineResponse;
  activeDirectionId: number;
}

export function LineLegend({ data, activeDirectionId }: Props): React.ReactElement | null {
  const t = useTranslations('od.lineSchedule.legend');
  const line = data.line;
  if (!line) return null;
  const color = getLineColor(line.shortName);
  const active = data.directions.find((d) => d.directionId === activeDirectionId);
  if (!active) return null;

  return (
    <div
      data-testid="line-legend"
      className="absolute left-3 top-3 z-10 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur"
    >
      <div className="mb-1 font-semibold tracking-tight">
        {t('header', { shortName: line.shortName })}
      </div>
      <div data-testid="line-legend-active" className="flex items-center gap-2 py-0.5">
        <span
          aria-hidden="true"
          className="inline-block h-1 w-8 rounded"
          style={{ backgroundColor: color }}
        />
        <span className="text-muted-foreground">
          {t('direction', { headsign: active.headsign })}
        </span>
      </div>
    </div>
  );
}
