'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Three mutually exclusive viewer modes (per the viewer-stop-info-mode +
 * viewer-line-schedule-mode specs). The active mode lives in the URL hash
 * so deep-links are shareable and the browser back/forward navigates
 * between them transparently.
 *
 * Hash format:
 *   /          → OD mode (default)
 *   /#         → OD mode
 *   /#stop=ID  → stop-info mode for the given GTFS stop id
 *   /#line=SH  → line-schedule mode for the given short name
 */
export type ViewerMode =
  | { type: 'od' }
  | { type: 'stop-info'; stopId: string }
  | { type: 'line-schedule'; shortName: string };

export interface SetModeOptions {
  /** Stash the current mode so restorePrevious() can return to it. */
  push?: boolean;
}

export interface ViewerModeApi {
  mode: ViewerMode;
  setMode: (next: ViewerMode, options?: SetModeOptions) => void;
  restorePrevious: () => void;
}

function parseHash(hash: string): ViewerMode {
  // hash includes the leading "#" — strip it.
  /* v8 ignore next */
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return { type: 'od' };
  if (raw.startsWith('stop=')) {
    const stopId = decodeURIComponent(raw.slice('stop='.length));
    /* v8 ignore next */
    if (stopId.length > 0) return { type: 'stop-info', stopId };
  }
  if (raw.startsWith('line=')) {
    const shortName = decodeURIComponent(raw.slice('line='.length));
    /* v8 ignore next */
    if (shortName.length > 0) return { type: 'line-schedule', shortName };
  }
  // Unknown content → defensive fallback to OD.
  return { type: 'od' };
}

function modeToHash(mode: ViewerMode): string {
  switch (mode.type) {
    case 'od':
      return '';
    case 'stop-info':
      return `#stop=${encodeURIComponent(mode.stopId)}`;
    case 'line-schedule':
      return `#line=${encodeURIComponent(mode.shortName)}`;
  }
}

function readMode(): ViewerMode {
  // SSR guard — Next's server pass has no `window`. Vitest happy-dom
  // always provides one, so this branch is unreachable in tests.
  /* v8 ignore next */
  if (typeof window === 'undefined') return { type: 'od' };
  return parseHash(window.location.hash);
}

export function useViewerMode(): ViewerModeApi {
  const [mode, setModeState] = useState<ViewerMode>(() => readMode());
  const previousRef = useRef<ViewerMode | null>(null);

  useEffect(() => {
    function onHashChange(): void {
      setModeState(readMode());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setMode = useCallback((next: ViewerMode, options: SetModeOptions = {}) => {
    if (options.push) {
      previousRef.current = mode;
    }
    const hash = modeToHash(next);
    // `history.pushState` doesn't fire hashchange, so we update state directly
    // and bypass the listener (which would otherwise see the same state).
    const url = hash === '' ? window.location.pathname + window.location.search : window.location.pathname + window.location.search + hash;
    window.history.pushState(null, '', url);
    setModeState(next);
  }, [mode]);

  const restorePrevious = useCallback(() => {
    const prev = previousRef.current ?? { type: 'od' as const };
    previousRef.current = null;
    const hash = modeToHash(prev);
    const url = hash === '' ? window.location.pathname + window.location.search : window.location.pathname + window.location.search + hash;
    window.history.pushState(null, '', url);
    setModeState(prev);
  }, []);

  return { mode, setMode, restorePrevious };
}
