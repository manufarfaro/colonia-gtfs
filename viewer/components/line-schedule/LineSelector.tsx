'use client';

import { useTranslations } from 'next-intl';
import { getLineColor } from '@/lib/colors/lines';

export function LineSelector({
  lines,
  onPickLine,
}: {
  lines: readonly string[];
  onPickLine: (shortName: string) => void;
}): React.ReactElement {
  const t = useTranslations('od.lineSchedule.selector');
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{t('label')}</span>
      {lines.map((shortName) => (
        <button
          key={shortName}
          type="button"
          data-testid={`line-chip-${shortName}`}
          aria-label={t('lineLabel', { shortName })}
          style={{ backgroundColor: getLineColor(shortName) }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
          onClick={() => onPickLine(shortName)}
        >
          {shortName}
        </button>
      ))}
    </div>
  );
}
