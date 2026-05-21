'use client';

import { useQuery } from '@tanstack/react-query';
import type { RestLineResponse } from '@/lib/otp/translate-line';

export type LineError = 'not_found' | 'otp_unavailable' | 'network';

export type LineState =
  | { state: 'idle'; data: null; error: null }
  | { state: 'loading'; data: null; error: null }
  | { state: 'success'; data: RestLineResponse; error: null }
  | { state: 'error'; data: null; error: LineError };

class LineQueryError extends Error {
  constructor(public readonly tag: LineError) {
    super(tag);
    this.name = 'LineQueryError';
  }
}

export function useLineQuery(shortName: string | null): LineState {
  const enabled = shortName !== null;
  const query = useQuery<RestLineResponse, LineQueryError>({
    queryKey: ['line', shortName],
    enabled,
    queryFn: async ({ signal }) => {
      let res: Response;
      try {
        res = await fetch(`/api/lines/${encodeURIComponent(shortName!)}`, { signal });
      } catch {
        throw new LineQueryError('network');
      }
      if (res.status === 404) throw new LineQueryError('not_found');
      if (res.status === 502) throw new LineQueryError('otp_unavailable');
      return (await res.json()) as RestLineResponse;
    },
  });

  if (!enabled) return { state: 'idle', data: null, error: null };
  if (query.isPending) return { state: 'loading', data: null, error: null };
  if (query.isError) return { state: 'error', data: null, error: query.error.tag };
  return { state: 'success', data: query.data!, error: null };
}
