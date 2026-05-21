'use client';

import { useTranslations } from 'next-intl';
import { formatEta, type EtaResult } from '@/lib/format/eta';
import type { ArrivalsResponse, ArrivalsState } from './useArrivalsQuery';

const headerTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Montevideo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function headerTime(now: Date): string {
  return headerTimeFmt.format(now).slice(0, 5);
}

interface Props {
  state: ArrivalsState;
  now: Date;
  onClose: () => void;
  onReturnHome: () => void;
}

function EtaText({ result }: { result: EtaResult }): React.ReactElement {
  const t = useTranslations('od.stopInfo.arrival');
  switch (result.kind) {
    case 'now':
      return <span>{t('etaNow')}</span>;
    case 'minutes':
      return <span>{t('etaMinutes', { minutes: result.minutes })}</span>;
    case 'absolute':
      return <span>{t('etaAbsolute', { time: result.time })}</span>;
    case 'passed':
      return <span>{t('etaPassed', { minutes: result.minutes })}</span>;
  }
}

function ArrivalRow({
  arrival,
  index,
  now,
}: {
  arrival: ArrivalsResponse['arrivals'][number];
  index: number;
  now: Date;
}): React.ReactElement {
  const t = useTranslations('od.stopInfo.arrival');
  const eta = formatEta(arrival.realtimeArrivalIso ?? arrival.scheduledArrivalIso, now);

  return (
    <li
      data-testid={`arrival-row-${index}`}
      className="flex items-center justify-between border-b border-border py-3 text-sm last:border-b-0"
    >
      <span className="font-medium">
        {t('line', { shortName: arrival.lineShortName })} · {arrival.headsign}
      </span>
      <span className="flex items-center gap-2 text-right">
        {arrival.isRealtime ? (
          <span
            data-testid="arrival-badge-live"
            className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            {t('badgeLive')}
          </span>
        ) : (
          <span data-testid="arrival-badge-scheduled" className="text-xs text-muted-foreground">
            {t('badgeScheduled')}
          </span>
        )}
        <span className={arrival.isRealtime ? 'font-semibold' : 'text-muted-foreground'}>
          <EtaText result={eta} />
        </span>
      </span>
    </li>
  );
}

export function StopInfoCard({ state, now, onClose, onReturnHome }: Props): React.ReactElement | null {
  const tState = useTranslations('od.stopInfo.state');
  const tHeader = useTranslations('od.stopInfo.header');

  if (state.state === 'idle') return null;

  if (state.state === 'loading') {
    return (
      <div data-testid="stop-info-loading" className="text-center text-sm text-muted-foreground">
        {tState('loading')}
      </div>
    );
  }

  if (state.state === 'error') {
    switch (state.error) {
      case 'empty':
        return <p className="text-center text-sm text-muted-foreground">{tState('errorEmpty')}</p>;
      case 'otp_unavailable':
        return <p className="text-center text-sm text-muted-foreground">{tState('errorOtp')}</p>;
      case 'network':
        return <p className="text-center text-sm text-muted-foreground">{tState('errorNetwork')}</p>;
      case 'not_found':
        return (
          <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <p>{tState('errorNotFound')}</p>
            <button
              type="button"
              onClick={onReturnHome}
              className="rounded-md border border-border px-3 py-1 text-foreground"
            >
              {tState('errorNotFoundReturn')}
            </button>
          </div>
        );
    }
  }

  // success
  const { stop, arrivals } = state.data;
  // The header always shows the latest poll's wall-clock — keep it simple
  // (no relative/absolute branching here; the per-row ETAs already do
  // that job and use the localised helper).
  const queryTimeLabel = headerTime(now);

  return (
    <div>
      <header data-testid="stop-info-header" className="flex items-baseline justify-between pb-2">
        <span className="text-lg font-semibold tracking-tight">{stop.name}</span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{tHeader('queriedAt', { time: queryTimeLabel })}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-0.5 text-muted-foreground"
          >
            {tHeader('close')}
          </button>
        </span>
      </header>
      <ol className="mt-2">
        {arrivals.map((a, i) => (
          <ArrivalRow key={`${a.lineShortName}-${a.scheduledArrivalIso}-${i}`} arrival={a} index={i} now={now} />
        ))}
      </ol>
    </div>
  );
}
