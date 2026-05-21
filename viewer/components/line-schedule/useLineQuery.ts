'use client';

import { useEffect, useRef, useState } from 'react';
import type { RestLineResponse } from '@/lib/otp/translate-line';

export type LineError = 'not_found' | 'otp_unavailable' | 'network';

export type LineState =
  | { state: 'idle'; data: null; error: null }
  | { state: 'loading'; data: null; error: null }
  | { state: 'success'; data: RestLineResponse; error: null }
  | { state: 'error'; data: null; error: LineError };

export function useLineQuery(shortName: string | null): LineState {
  const [snapshot, setSnapshot] = useState<LineState>({ state: 'idle', data: null, error: null });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (shortName === null) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSnapshot({ state: 'idle', data: null, error: null });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSnapshot({ state: 'loading', data: null, error: null });

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/lines/${encodeURIComponent(shortName)}`, {
          signal: controller.signal,
        });
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
        const body = (await res.json()) as RestLineResponse;
        /* v8 ignore next */
        if (cancelled || controller.signal.aborted) return;
        setSnapshot({ state: 'success', data: body, error: null });
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        /* v8 ignore next */
        if (cancelled) return;
        setSnapshot({ state: 'error', data: null, error: 'network' });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [shortName]);

  return snapshot;
}
