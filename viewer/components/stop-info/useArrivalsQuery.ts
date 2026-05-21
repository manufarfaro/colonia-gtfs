'use client';

import { useQuery } from '@tanstack/react-query';

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

class ArrivalsQueryError extends Error {
  constructor(public readonly tag: ArrivalsError) {
    super(tag);
    this.name = 'ArrivalsQueryError';
  }
}

export function useArrivalsQuery(stopId: string | null): ArrivalsState {
  const enabled = stopId !== null;
  const query = useQuery<ArrivalsResponse, ArrivalsQueryError>({
    queryKey: ['arrivals', stopId],
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    queryFn: async ({ signal }) => {
      let res: Response;
      try {
        res = await fetch(`/api/stops/${encodeURIComponent(stopId!)}/arrivals?limit=10`, { signal });
      } catch {
        throw new ArrivalsQueryError('network');
      }
      if (res.status === 404) throw new ArrivalsQueryError('not_found');
      if (res.status === 502) throw new ArrivalsQueryError('otp_unavailable');
      const body = (await res.json()) as ArrivalsResponse;
      if (!body.arrivals || body.arrivals.length === 0) {
        throw new ArrivalsQueryError('empty');
      }
      return body;
    },
  });

  if (!enabled) return { state: 'idle', data: null, error: null };
  if (query.isPending) return { state: 'loading', data: null, error: null };
  if (query.isError) return { state: 'error', data: null, error: query.error.tag };
  return { state: 'success', data: query.data!, error: null };
}
