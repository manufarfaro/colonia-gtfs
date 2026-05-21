'use client';

import { useEffect, useRef, useState } from 'react';
import { nowInMontevideoPlusOneMinute } from '@/lib/time/montevideo';
import type { RestPlanResponse } from '@/lib/otp/translate-plan';

export interface PlanInput {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
}

export type PlanError = 'otp_unavailable' | 'invalid_request' | 'empty' | 'network';

export type PlanState =
  | { state: 'idle'; data: null; error: null }
  | { state: 'loading'; data: null; error: null }
  | { state: 'success'; data: RestPlanResponse; error: null }
  | { state: 'error'; data: null; error: PlanError };

export function usePlanQuery(
  from: PlanInput['from'] | null,
  to: PlanInput['to'] | null,
): PlanState {
  const [snapshot, setSnapshot] = useState<PlanState>({ state: 'idle', data: null, error: null });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // If either endpoint is missing, reset to idle (and cancel anything in flight).
    if (from === null || to === null) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSnapshot({ state: 'idle', data: null, error: null });
      return;
    }

    // New request — cancel any previous and start fresh.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSnapshot({ state: 'loading', data: null, error: null });

    const { date, time } = nowInMontevideoPlusOneMinute();

    void (async (): Promise<void> => {
      try {
        const res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from, to, date, time }),
          signal: controller.signal,
        });
        // Race guard: abort fired after fetch resolved but before we set
        // state. The catch already handles in-flight aborts; this check
        // covers the "fetch returned faster than the abort propagated"
        // window — practically unreachable in synchronous tests, hence
        // marked as ignored for coverage.
        /* v8 ignore next */
        if (controller.signal.aborted) return;

        if (res.status === 502) {
          setSnapshot({ state: 'error', data: null, error: 'otp_unavailable' });
          return;
        }
        if (res.status === 400) {
          setSnapshot({ state: 'error', data: null, error: 'invalid_request' });
          return;
        }
        const body = (await res.json()) as RestPlanResponse;
        /* v8 ignore next */
        if (controller.signal.aborted) return;
        if (!body.itineraries || body.itineraries.length === 0) {
          setSnapshot({ state: 'error', data: null, error: 'empty' });
          return;
        }
        setSnapshot({ state: 'success', data: body, error: null });
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setSnapshot({ state: 'error', data: null, error: 'network' });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [from?.lat, from?.lon, to?.lat, to?.lon]);

  return snapshot;
}
