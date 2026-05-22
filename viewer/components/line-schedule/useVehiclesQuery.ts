'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

// Aligned to the bridge's upstream poll cadence (15s — see
// .env POLL_INTERVAL_MS). Polling more frequently just returns the
// same cached snapshot until the bridge fetches the next AVL frame.
const POLL_INTERVAL_MS = 15_000;

// How long a non-empty vehicles response stays "fresh" — when the
// next poll returns `vehicles: []` (a transient bridge/AVL miss), we
// keep showing the previous positions for this many milliseconds
// before accepting the empty state. 5 minutes covers extended
// upstream gaps (operator dropouts, matcher misses) without showing
// indefinitely stale data.
const STALE_HOLD_MS = 5 * 60_000;

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

class VehiclesQueryError extends Error {
  constructor(public readonly tag: VehiclesError) {
    super(tag);
    this.name = 'VehiclesQueryError';
  }
}

export function useVehiclesQuery(shortName: string | null): VehiclesState {
  const enabled = shortName !== null;
  const query = useQuery<VehiclesResponse, VehiclesQueryError>({
    queryKey: ['vehicles', shortName],
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      let res: Response;
      try {
        res = await fetch(`/api/lines/${encodeURIComponent(shortName!)}/vehicles`, { signal });
      } catch {
        throw new VehiclesQueryError('network');
      }
      return (await res.json()) as VehiclesResponse;
    },
  });

  const lastNonEmpty = useRef<{ data: VehiclesResponse; ts: number } | null>(null);

  useEffect(() => {
    if (query.isSuccess && query.data.vehicles.length > 0) {
      lastNonEmpty.current = { data: query.data, ts: Date.now() };
    }
  }, [query.data, query.isSuccess]);

  useEffect(() => {
    lastNonEmpty.current = null;
  }, [shortName]);

  if (!enabled) return { state: 'idle', data: null, error: null };
  if (query.isPending) return { state: 'loading', data: null, error: null };
  if (query.isError) return { state: 'error', data: null, error: query.error.tag };

  const fresh = query.data!;
  const cached = lastNonEmpty.current;
  if (fresh.vehicles.length === 0 && cached && Date.now() - cached.ts < STALE_HOLD_MS) {
    return { state: 'success', data: cached.data, error: null };
  }
  return { state: 'success', data: fresh, error: null };
}
