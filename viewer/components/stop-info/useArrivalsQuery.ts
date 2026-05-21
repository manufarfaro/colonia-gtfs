'use client';

import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;

export interface ArrivalsResponse {
  stop: { id: string; name: string; lat: number; lon: number };
  arrivals: Array<{
    lineShortName: string;
    headsign: string;
    scheduledArrivalIso: string;
    realtimeArrivalIso: string | null;
    isRealtime: boolean;
    delaySeconds: number;
  }>;
  meta: { queriedAt: string; realtime_available: boolean };
}

export type ArrivalsError = 'not_found' | 'empty' | 'otp_unavailable' | 'network';

export type ArrivalsState =
  | { state: 'idle'; data: null; error: null }
  | { state: 'loading'; data: null; error: null }
  | { state: 'success'; data: ArrivalsResponse; error: null }
  | { state: 'error'; data: null; error: ArrivalsError };

export function useArrivalsQuery(stopId: string | null): ArrivalsState {
  const [snapshot, setSnapshot] = useState<ArrivalsState>({ state: 'idle', data: null, error: null });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (stopId === null) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSnapshot({ state: 'idle', data: null, error: null });
      return;
    }

    let cancelled = false;

    async function poll(): Promise<void> {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      // Race guard: cleanup ran before the effect re-entered. Defensive.
      /* v8 ignore next 3 */
      if (!cancelled) {
        setSnapshot((prev) => (prev.state === 'idle' ? { state: 'loading', data: null, error: null } : prev));
      }
      try {
        const res = await fetch(`/api/stops/${encodeURIComponent(stopId!)}/arrivals?limit=10`, {
          signal: controller.signal,
        });
        // Post-resolution abort race — practically unreachable in tests.
        /* v8 ignore next */
        if (cancelled || controller.signal.aborted) return;
        if (res.status === 404) {
          setSnapshot({ state: 'error', data: null, error: 'not_found' });
          return;
        }
        if (res.status === 502) {
          setSnapshot({ state: 'error', data: null, error: 'otp_unavailable' });
          return;
        }
        const body = (await res.json()) as ArrivalsResponse;
        /* v8 ignore next */
        if (cancelled || controller.signal.aborted) return;
        if (!body.arrivals || body.arrivals.length === 0) {
          setSnapshot({ state: 'error', data: null, error: 'empty' });
          return;
        }
        setSnapshot({ state: 'success', data: body, error: null });
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        // Race guard: stale fetch after cleanup. Practically unreachable.
        /* v8 ignore next */
        if (cancelled) return;
        setSnapshot({ state: 'error', data: null, error: 'network' });
      }
    }

    setSnapshot({ state: 'loading', data: null, error: null });
    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [stopId]);

  return snapshot;
}
