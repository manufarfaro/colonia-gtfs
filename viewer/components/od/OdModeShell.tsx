'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ItineraryCard } from './ItineraryCard';
import { ItineraryOptionsList } from './ItineraryOptionsList';
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

export function OdModeShell({ apiKey }: { apiKey: string | undefined }): React.ReactElement {
  const t = useTranslations('od');
  const { mode, setMode, restorePrevious } = useViewerMode();

  const [endpoints, setEndpoints] = useState<OdInputsChange>({ from: null, to: null });
  const handleChange = useCallback((next: OdInputsChange) => setEndpoints(next), []);
  const plan = usePlanQuery(endpoints.from, endpoints.to);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const itinerariesCount = plan.state === 'success' ? plan.data.itineraries.length : 0;
  useEffect(() => {
    setSelectedIdx(0);
  }, [itinerariesCount]);
  const selectedItinerary =
    mode.type === 'od' && plan.state === 'success' ? plan.data.itineraries[selectedIdx] : null;

  const stopId = mode.type === 'stop-info' ? mode.stopId : null;
  const arrivals = useArrivalsQuery(stopId);

  const lineShort = mode.type === 'line-schedule' ? mode.shortName : null;
  const lineData = useLineQuery(lineShort);
  const vehicles = useVehiclesQuery(lineShort);
  const [activeLineDir, setActiveLineDir] = useState<number>(0);
  useEffect(() => {
    setActiveLineDir(0);
  }, [lineShort]);

  const handleStopClick = useCallback(
    (id: string) => setMode({ type: 'stop-info', stopId: id }, { push: true }),
    [setMode],
  );
  const handleStopInfoClose = useCallback(() => restorePrevious(), [restorePrevious]);
  const handlePickLine = useCallback(
    (shortName: string) => setMode({ type: 'line-schedule', shortName }),
    [setMode],
  );
  const handleLineClose = useCallback(() => setMode({ type: 'od' }), [setMode]);
  const handleOpenLineSelector = useCallback(
    () => setMode({ type: 'line-schedule', shortName: V0_LINES[0] }),
    [setMode],
  );

  const lineLayer =
    mode.type === 'line-schedule' && lineData.state === 'success' && lineData.data.line
      ? {
          data: lineData.data,
          vehicles: vehicles.state === 'success' ? vehicles.data.vehicles : [],
          activeDirectionId: activeLineDir,
          onActiveDirectionChange: setActiveLineDir,
        }
      : undefined;

  const shell = (
    <div data-testid="od-shell" className="absolute inset-0 md:flex md:flex-row">
      <aside
        data-testid="od-sidebar"
        className="hidden md:flex md:flex-col md:w-[360px] md:shrink-0 md:border-r md:border-border md:bg-card md:overflow-y-auto"
      >
        <div className="border-b border-border p-4 animate-fade-in-up [animation-delay:0ms]">
          {mode.type === 'od' && (
            <div className="flex flex-col gap-2">
              <OriginDestinationInputs onChange={handleChange} />
              <button
                type="button"
                data-testid="open-line-selector-desktop"
                onClick={handleOpenLineSelector}
                className="self-start rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {t('lineSchedule.selector.openLabel')}
              </button>
            </div>
          )}
          {mode.type === 'line-schedule' && (
            <div className="flex flex-col gap-2">
              <LineSelector lines={V0_LINES} onPickLine={handlePickLine} />
              <button
                type="button"
                data-testid="exit-line-selector-desktop"
                onClick={handleLineClose}
                className="self-start rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {t('lineSchedule.selector.exit')}
              </button>
            </div>
          )}
        </div>

        <div className="p-4 flex-1 animate-fade-in-up [animation-delay:120ms]">
          {mode.type === 'od' && (
            plan.state === 'idle' ? (
              <div className="text-center text-sm text-muted-foreground">{t('state.idleHint')}</div>
            ) : plan.state === 'loading' ? (
              <div className="text-center text-sm text-muted-foreground">{t('state.loadingLabel')}</div>
            ) : plan.state === 'error' ? (
              <div role="alert" className="text-center text-sm text-muted-foreground">
                {plan.error === 'otp_unavailable'
                  ? t('state.errorOtp')
                  : plan.error === 'invalid_request'
                    ? t('state.errorInvalid')
                    : t('state.errorEmpty')}
              </div>
            ) : (
              <ItineraryOptionsList
                itineraries={plan.data.itineraries}
                selectedIndex={selectedIdx}
                onSelect={setSelectedIdx}
                renderDetail={(itinerary) => <ItineraryCard itinerary={itinerary} />}
              />
            )
          )}
          {mode.type === 'line-schedule' && (
            lineData.state === 'loading' || lineData.state === 'idle' ? (
              <div className="text-center text-sm text-muted-foreground">{t('lineSchedule.state.loading')}</div>
            ) : lineData.state === 'error' ? (
              <div role="alert" className="text-center text-sm text-muted-foreground">
                {lineData.error === 'not_found'
                  ? t('lineSchedule.state.errorNotFound')
                  : t('lineSchedule.state.errorOtp')}
              </div>
            ) : lineData.data.line ? (
              <LineScheduleCard
                data={lineData.data}
                onActiveDirectionChange={setActiveLineDir}
              />
            ) : (
              <div role="alert" className="text-center text-sm text-muted-foreground">
                {t('lineSchedule.state.errorNotFound')}
              </div>
            )
          )}
        </div>
      </aside>

      <div className="relative flex-1 md:h-full">
        <div
          data-testid="od-search-slot"
          className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-3 animate-fade-in-up [animation-delay:0ms] md:hidden"
        >
          {mode.type === 'od' && (
            <div className="flex items-center justify-between gap-2">
              <OriginDestinationInputs onChange={handleChange} />
              <button
                type="button"
                data-testid="open-line-selector"
                onClick={handleOpenLineSelector}
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
          <div
            data-testid="od-map-slot"
            className="absolute inset-0 -z-0 animate-fade-in-up [animation-delay:60ms]"
          >
            <MapCanvas
              itinerary={selectedItinerary}
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

        {mode.type === 'line-schedule' && (
          <div
            data-testid="line-schedule-bottom"
            className="fixed inset-x-0 bottom-0 z-20 md:hidden"
          >
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
                <LineScheduleCard
                data={lineData.data}
                onActiveDirectionChange={setActiveLineDir}
              />
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

        {mode.type === 'od' && (
          <div
            data-testid="od-bottom-sheet"
            className="fixed inset-x-0 bottom-0 z-20 animate-fade-in-up [animation-delay:120ms] md:hidden"
          >
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
              selectedItinerary && <ItineraryCard itinerary={selectedItinerary} />
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!apiKey) return shell;
  return (
    <APIProvider apiKey={apiKey} libraries={['places', 'geometry']}>
      {shell}
    </APIProvider>
  );
}
