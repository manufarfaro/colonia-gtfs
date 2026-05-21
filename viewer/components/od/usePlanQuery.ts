'use client';

import { useQuery } from '@tanstack/react-query';
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

class PlanQueryError extends Error {
  constructor(public readonly tag: PlanError) {
    super(tag);
    this.name = 'PlanQueryError';
  }
}

export function usePlanQuery(
  from: PlanInput['from'] | null,
  to: PlanInput['to'] | null,
): PlanState {
  const enabled = from !== null && to !== null;
  const query = useQuery<RestPlanResponse, PlanQueryError>({
    queryKey: ['plan', from, to],
    enabled,
    queryFn: async ({ signal }) => {
      const { date, time } = nowInMontevideoPlusOneMinute();
      let res: Response;
      try {
        res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from, to, date, time }),
          signal,
        });
      } catch {
        throw new PlanQueryError('network');
      }
      if (res.status === 502) throw new PlanQueryError('otp_unavailable');
      if (res.status === 400) throw new PlanQueryError('invalid_request');
      const body = (await res.json()) as RestPlanResponse;
      if (!body.itineraries || body.itineraries.length === 0) {
        throw new PlanQueryError('empty');
      }
      return body;
    },
  });

  if (!enabled) return { state: 'idle', data: null, error: null };
  if (query.isPending) return { state: 'loading', data: null, error: null };
  if (query.isError) return { state: 'error', data: null, error: query.error.tag };
  return { state: 'success', data: query.data!, error: null };
}
