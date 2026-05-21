'use client';

import { useQuery } from '@tanstack/react-query';

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
    // Endpoint always returns 200 (per viewer-shell-and-api R-07, bridge
    // down sends `{vehicles:[], meta:{realtime_available:false}}`), so
    // `staleTime: 0` keeps each poll fresh without dedup.
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

  if (!enabled) return { state: 'idle', data: null, error: null };
  if (query.isPending) return { state: 'loading', data: null, error: null };
  if (query.isError) return { state: 'error', data: null, error: query.error.tag };
  return { state: 'success', data: query.data!, error: null };
}
