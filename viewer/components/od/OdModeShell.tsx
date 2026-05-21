'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ItineraryCard } from './ItineraryCard';
import { MapCanvas } from './MapCanvas';
import { OriginDestinationInputs, type OdInputsChange } from './OriginDestinationInputs';
import { usePlanQuery } from './usePlanQuery';

/**
 * Mode O→D shell. Owns the from/to client state, drives the plan
 * request via `usePlanQuery`, and composes the search bar + map canvas
 * + itinerary card across the four documented UI states (idle, loading,
 * success, error).
 *
 * When `apiKey` is undefined we render a static banner explaining the
 * missing env var instead of the map slot — chrome + endpoints still
 * work, fail-closed without a runtime crash.
 */
export function OdModeShell({ apiKey }: { apiKey: string | undefined }): React.ReactElement {
  const t = useTranslations('od');
  const [endpoints, setEndpoints] = useState<OdInputsChange>({ from: null, to: null });
  const handleChange = useCallback((next: OdInputsChange) => setEndpoints(next), []);
  const plan = usePlanQuery(endpoints.from, endpoints.to);

  return (
    <div data-testid="od-shell" className="relative h-full w-full">
      <div
        data-testid="od-search-slot"
        className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-3"
      >
        <OriginDestinationInputs onChange={handleChange} />
      </div>

      {apiKey ? (
        <div data-testid="od-map-slot" className="absolute inset-0 -z-0">
          <MapCanvas apiKey={apiKey} itinerary={plan.state === 'success' ? plan.data.itineraries[0] : null} />
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

      <div data-testid="od-bottom-sheet" className="fixed inset-x-0 bottom-0 z-20">
        {plan.state === 'idle' ? (
          <div data-testid="od-state-idle" className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground">
            {t('state.idleHint')}
          </div>
        ) : plan.state === 'loading' ? (
          <div data-testid="od-state-loading" className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground">
            {t('state.loadingLabel')}
          </div>
        ) : plan.state === 'error' ? (
          <div data-testid={`od-state-error-${plan.error}`} role="alert" className="border-t border-border bg-background p-4 text-center text-sm text-muted-foreground">
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
    </div>
  );
}
