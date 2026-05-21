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

/**
 * Mode O→D shell. Owns the from/to client state, drives the plan
 * request via `usePlanQuery`, and composes the search bar + map canvas
 * + bottom sheet. Switches the sheet content based on the current
 * viewer mode (`od` | `stop-info`).
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

  // Stop-info state — driven by the mode hook so deep-links + tap-on-stop
  // both flow through the same path.
  const stopId = mode.type === 'stop-info' ? mode.stopId : null;
  const arrivals = useArrivalsQuery(stopId);

  const handleStopClick = useCallback(
    (id: string) => {
      setMode({ type: 'stop-info', stopId: id }, { push: true });
    },
    [setMode],
  );
  const handleStopInfoClose = useCallback(() => {
    restorePrevious();
  }, [restorePrevious]);

  return (
    <div data-testid="od-shell" className="relative h-full w-full">
      <div
        data-testid="od-search-slot"
        className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-3"
      >
        {mode.type === 'od' ? <OriginDestinationInputs onChange={handleChange} /> : null}
      </div>

      {apiKey ? (
        <div data-testid="od-map-slot" className="absolute inset-0 -z-0">
          <MapCanvas
            apiKey={apiKey}
            itinerary={plan.state === 'success' ? plan.data.itineraries[0] : null}
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

      {/* Stop-info sheet — opens via tap-on-stop or deep-link. */}
      <BottomSheet
        open={mode.type === 'stop-info'}
        onClose={handleStopInfoClose}
        ariaLabel="Stop info"
      >
        <StopInfoCard
          state={arrivals}
          now={new Date()}
          onClose={handleStopInfoClose}
          // The "Volver al inicio" button on the not-found error branch
          // forces the mode back to OD (bypassing the previous-mode stash).
          onReturnHome={() => setMode({ type: 'od' })}
        />
      </BottomSheet>

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
