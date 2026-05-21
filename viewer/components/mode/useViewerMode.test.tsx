import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useViewerMode } from './useViewerMode';

function setHash(h: string): void {
  // Use replaceState so the test doesn't pollute browser history between cases.
  window.history.replaceState(null, '', h);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useViewerMode', () => {
  it('R-01 returns OD mode when no hash is present', () => {
    const { result } = renderHook(() => useViewerMode());
    expect(result.current.mode.type).toBe('od');
  });

  it('R-01 parses #stop=<gtfsId> into stop-info mode', () => {
    window.history.replaceState(null, '', '#stop=sol-antigua:3');
    const { result } = renderHook(() => useViewerMode());
    expect(result.current.mode).toEqual({ type: 'stop-info', stopId: 'sol-antigua:3' });
  });

  it('R-01 parses #line=<shortName> into line-schedule mode', () => {
    window.history.replaceState(null, '', '#line=4');
    const { result } = renderHook(() => useViewerMode());
    expect(result.current.mode).toEqual({ type: 'line-schedule', shortName: '4' });
  });

  it('R-01 setMode writes the hash and reflects the new state', () => {
    const { result } = renderHook(() => useViewerMode());
    act(() => {
      result.current.setMode({ type: 'stop-info', stopId: 'sol-antigua:7' });
    });
    expect(window.location.hash).toBe('#stop=sol-antigua%3A7');
    expect(result.current.mode).toEqual({ type: 'stop-info', stopId: 'sol-antigua:7' });
  });

  it('R-01 setMode back to od clears the hash', () => {
    window.history.replaceState(null, '', '#stop=sol-antigua:3');
    const { result } = renderHook(() => useViewerMode());
    act(() => {
      result.current.setMode({ type: 'od' });
    });
    expect(window.location.hash).toBe('');
    expect(result.current.mode.type).toBe('od');
  });

  it('R-01 reacts to external hashchange (browser back/forward)', () => {
    const { result } = renderHook(() => useViewerMode());
    expect(result.current.mode.type).toBe('od');
    act(() => {
      setHash('#stop=external-source');
    });
    expect(result.current.mode).toEqual({ type: 'stop-info', stopId: 'external-source' });
  });

  it('R-01 unknown hash content falls back to OD (defensive)', () => {
    window.history.replaceState(null, '', '#garbage');
    const { result } = renderHook(() => useViewerMode());
    expect(result.current.mode.type).toBe('od');
  });

  it('R-01 push:true stashes previous, restore returns to it', () => {
    window.history.replaceState(null, '', '#line=4');
    const { result } = renderHook(() => useViewerMode());
    expect(result.current.mode).toEqual({ type: 'line-schedule', shortName: '4' });
    act(() => {
      result.current.setMode({ type: 'stop-info', stopId: 'sol-antigua:3' }, { push: true });
    });
    expect(result.current.mode).toEqual({ type: 'stop-info', stopId: 'sol-antigua:3' });
    act(() => {
      result.current.restorePrevious();
    });
    expect(result.current.mode).toEqual({ type: 'line-schedule', shortName: '4' });
  });

  it('R-01 restorePrevious without prior push returns to OD', () => {
    const { result } = renderHook(() => useViewerMode());
    act(() => {
      result.current.restorePrevious();
    });
    expect(result.current.mode.type).toBe('od');
  });
});
