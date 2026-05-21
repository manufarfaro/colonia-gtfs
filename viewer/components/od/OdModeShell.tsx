'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ItineraryCard } from './ItineraryCard';
import { MapCanvas } from './MapCanvas';
import { OriginDestinationInputs, type OdInputsChange } from './OriginDestinationInputs';
import { usePlanQuery } from './usePlanQuery';
import { BottomSheet } from './sheet/BottomSheet';
import { useViewerMode } from '@/components/mode/useViewerMode';
import { StopInfoCard } from '@/components/stop-info/StopInfoCard';
import { useArrivalsQuery } from '@/components/stop-info/useArrivalsQuery';
import { LineSelector } from '@/components/line-schedule/LineSelector';
import { LineScheduleCard } from '@/components/line-schedule/LineScheduleCard';
import { useLineQuery } from '@/components/line-schedule/useLineQuery';
import { useVehiclesQuery } from '@/components/line-schedule/useVehiclesQuery';

const V0_LINES = ['3', '4', '5', '8'] as const;

/**
 * Mode O→D shell. Composes the three viewer modes (od / stop-info /
 * line-schedule) over a single page. The active mode is driven by
 * `useViewerMode` (URL hash). The shell:
 *  - mounts mode-specific data hooks (plan / arrivals / line + vehicles)
 *  - swaps the search slot content per mode (OD inputs / Líneas chips)
 *  - swaps the bottom region per mode (OD bar / stop-info sheet /
 *    line-schedule sheet)
 *  - threads `onStopClick` from the map down so tap-on-stop pushes the
 *    stop-info mode on top of whatever the user was browsing.
 *
 * When `apiKey` is undefined we render a static banner explaining the
 * missing env var instead of the map slot — chrome + endpoints still
 * work, fail-closed without a runtime crash.
 */
export function OdModeShell({ apiKey }: { apiKey: string | undefined }): React.ReactElement {
  const t = useTranslations('od');
  const { mode, setMode, restorePrevious } = useViewerMode();

  // OD endpoints state — only meaningful when the active mode is OD.
  const [endpoints, setEndpoints] = useState<OdInputsChange>({ from: null, to: null });
  const handleChange = useCallback((next: OdInputsChange) => setEndpoints(next), []);
  const plan = usePlanQuery(endpoints.from, endpoints.to);

  // Stop-info state — driven by the mode hook.
  const stopId = mode.type === 'stop-info' ? mode.stopId : null;
  const arrivals = useArrivalsQuery(stopId);

  // Line-schedule state.
  const lineShort = mode.type === 'line-schedule' ? mode.shortName : null;
  const lineData = useLineQuery(lineShort);
  const vehicles = useVehiclesQuery(lineShort);

  const handleStopClick = useCallback(
    (id: string) => {
      setMode({ type: 'stop-info', stopId: id }, { push: true });
    },
    [setMode],
  );
  const handleStopInfoClose = useCallback(() => {
    restorePrevious();
  }, [restorePrevious]);
  const handlePickLine = useCallback(
    (shortName: string) => {
      setMode({ type: 'line-schedule', shortName });
    },
    [setMode],
  );
  const handleLineClose = useCallback(() => {
    setMode({ type: 'od' });
  }, [setMode]);
  const handleStopInOtherMode = useCallback(
    (id: string) => {
      setMode({ type: 'stop-info', stopId: id }, { push: true });
    },
    [setMode],
  );

  const lineLayer =
    mode.type === 'line-schedule' && lineData.state === 'success' && lineData.data.line
      ? { data: lineData.data, vehicles: vehicles.state === 'success' ? vehicles.data.vehicles : [] }
      : undefined;

  return (
    <div data-testid="od-shell" className="relative h-full w-full">
      <div
        data-testid="od-search-slot"
        className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-3"
      >
        {mode.type === 'od' && (
          <div className="flex items-center justify-between gap-2">
            <OriginDestinationInputs onChange={handleChange} />
            <button
              type="button"
              data-testid="open-line-selector"
              onClick={() => setMode({ type: 'line-schedule', shortName: V0_LINES[0] })}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
            >
              {t('lineSchedule.selector.openLabel')}
            </button>
          </div>
        )}
        {mode.type === 'line-schedule' && (
          <div className="flex items-center justify-between gap-2">
            <LineSelector lines={V0_LINES} onPickLine={handlePickLine} />
            <button
              type="button"
              data-testid="exit-line-selector"
              onClick={handleLineClose}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
            >
              {t('lineSchedule.selector.exit')}
            </button>
          </div>
        )}
      </div>

      {apiKey ? (
        <div data-testid="od-map-slot" className="absolute inset-0 -z-0">
          <MapCanvas
            apiKey={apiKey}
            itinerary={
              mode.type === 'od' && plan.state === 'success' ? plan.data.itineraries[0] : null
            }
            lineLayer={lineLayer}
            onStopClick={handleStopClick}
          />
        </div>
      ) : (
        <div
          data-testid="od-api-key-missing"
          role="alert"
          className="mx-4 mt-4 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          {t('apiKeyMissing')}
        </div>
      )}

      {/* Stop-info sheet — opens via tap-on-stop or deep-link. Apilable
          encima de cualquier otro modo gracias al push semantics del hook. */}
      <BottomSheet
        open={mode.type === 'stop-info'}
        onClose={handleStopInfoClose}
        ariaLabel="Stop info"
      >
        <StopInfoCard
          state={arrivals}
          now={new Date()}
          onClose={handleStopInfoClose}
          onReturnHome={() => setMode({ type: 'od' })}
        />
      </BottomSheet>

      {/* Line-schedule sheet — when the line query succeeds, show the
          card with tabs + scheduled departures. Loading/error states use
          the same inline bar pattern as OD. */}
      {mode.type === 'line-schedule' && (
        <div data-testid="line-schedule-bottom" className="fixed inset-x-0 bottom-0 z-20">
          {lineData.state === 'loading' || lineData.state === 'idle' ? (
            <div
              data-testid="line-state-loading"
              className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground"
            >
              {t('lineSchedule.state.loading')}
            </div>
          ) : lineData.state === 'error' ? (
            <div
              data-testid={`line-state-error-${lineData.error}`}
              role="alert"
              className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground"
            >
              {lineData.error === 'not_found'
                ? t('lineSchedule.state.errorNotFound')
                : t('lineSchedule.state.errorOtp')}
            </div>
          ) : lineData.data.line ? (
            <div className="border-t border-border bg-background p-4">
              <LineScheduleCard data={lineData.data} onStopClick={handleStopInOtherMode} />
            </div>
          ) : (
            <div
              data-testid="line-state-error-not_found"
              role="alert"
              className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground"
            >
              {t('lineSchedule.state.errorNotFound')}
            </div>
          )}
        </div>
      )}

      {/* OD bottom bar — inline (not modal) for idle/loading/error;
          BottomSheet for success only. Hidden whenever a different mode
          owns the bottom region. */}
      {mode.type === 'od' && (
        <div data-testid="od-bottom-sheet" className="fixed inset-x-0 bottom-0 z-20">
          {plan.state === 'idle' ? (
            <div
              data-testid="od-state-idle"
              className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground"
            >
              {t('state.idleHint')}
            </div>
          ) : plan.state === 'loading' ? (
            <div
              data-testid="od-state-loading"
              className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground"
            >
              {t('state.loadingLabel')}
            </div>
          ) : plan.state === 'error' ? (
            <div
              data-testid={`od-state-error-${plan.error}`}
              role="alert"
              className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground"
            >
              {plan.error === 'otp_unavailable'
                ? t('state.errorOtp')
                : plan.error === 'invalid_request'
                  ? t('state.errorInvalid')
                  : t('state.errorEmpty')}
            </div>
          ) : (
            <ItineraryCard itinerary={plan.data.itineraries[0]} />
          )}
        </div>
      )}
    </div>
  );
}
