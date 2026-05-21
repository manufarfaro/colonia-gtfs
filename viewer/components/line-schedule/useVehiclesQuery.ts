'use client';

import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 15_000;

export interface VehiclesResponse {
  lineId: string;
  vehicles: Array<{
    id: string;
    label: string | null;
    routeId: string | null;
    directionId: number | null;
    lat: number;
    lon: number;
    bearing: number | null;
    timestamp: number | null;
  }>;
  meta: { realtime_available: boolean; feed_timestamp: number | null };
}

export type VehiclesError = 'network';

export type VehiclesState =
  | { state: 'idle'; data: null; error: null }
  | { state: 'loading'; data: null; error: null }
  | { state: 'success'; data: VehiclesResponse; error: null }
  | { state: 'error'; data: null; error: VehiclesError };

export function useVehiclesQuery(shortName: string | null): VehiclesState {
  const [snapshot, setSnapshot] = useState<VehiclesState>({ state: 'idle', data: null, error: null });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (shortName === null) {
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
      try {
        const res = await fetch(`/api/lines/${encodeURIComponent(shortName!)}/vehicles`, {
          signal: controller.signal,
        });
        /* v8 ignore next */
        if (cancelled || controller.signal.aborted) return;
        const body = (await res.json()) as VehiclesResponse;
        /* v8 ignore next */
        if (cancelled || controller.signal.aborted) return;
        setSnapshot({ state: 'success', data: body, error: null });
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
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
  }, [shortName]);

  return snapshot;
}
