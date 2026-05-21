import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useArrivalsQuery } from './useArrivalsQuery';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const okBody = {
  stop: { id: 'sol-antigua:3', name: 'INT SUAREZ', lat: -34.47, lon: -57.85 },
  arrivals: [
    { lineShortName: '4', headsign: 'Centro', scheduledArrivalIso: '2026-05-20T14:32:00Z', realtimeArrivalIso: '2026-05-20T14:32:30Z', isRealtime: true, delaySeconds: 30 },
  ],
  meta: { queriedAt: '2026-05-20T14:30:00Z', realtime_available: true },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useArrivalsQuery', () => {
  it('R-04 stays idle when stopId is null', () => {
    const { result } = renderHook(() => useArrivalsQuery(null));
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-04 idle → loading → success on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'));
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.arrivals).toHaveLength(1);
  });

  it('R-04 idle → loading → error.empty on 200 with empty arrivals', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...okBody, arrivals: [] }));
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('empty');
  });

  it('R-04 idle → loading → error.notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'stop_not_found' }, 404));
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:missing'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('not_found');
  });

  it('R-04 idle → loading → error.otp on 502', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('otp_unavailable');
  });

  it('R-04 idle → loading → error.network on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-04 registers a 30 s setInterval poll while the hook is mounted', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { unmount } = renderHook(() => useArrivalsQuery('sol-antigua:3'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    // Manually invoke the registered interval callback to simulate a tick
    // (more deterministic than vi.advanceTimersByTime across renders).
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const intervalCallback = setIntervalSpy.mock.calls[0][0] as () => void;
    intervalCallback();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    unmount();
    setIntervalSpy.mockRestore();
  });

  it('R-04 switching stopId aborts previous + starts fresh', async () => {
    let receivedAbort = false;
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          receivedAbort = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...okBody, stop: { ...okBody.stop, id: 'sol-antigua:7' } }));

    const { result, rerender } = renderHook(({ stopId }: { stopId: string | null }) => useArrivalsQuery(stopId), {
      initialProps: { stopId: 'sol-antigua:3' as string | null },
    });
    expect(result.current.state).toBe('loading');
    rerender({ stopId: 'sol-antigua:7' });
    await waitFor(() => {
      expect(receivedAbort).toBe(true);
      expect(result.current.state).toBe('success');
    });
    expect(result.current.data?.stop.id).toBe('sol-antigua:7');
  });

  it('R-04 unmount aborts in-flight + clears interval', async () => {
    let receivedAbort = false;
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          receivedAbort = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useArrivalsQuery('sol-antigua:3'));
    unmount();
    await waitFor(() => expect(receivedAbort).toBe(true));
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('R-04 stopping (stopId=null) resets to idle + clears interval', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okBody));
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { result, rerender } = renderHook(
      ({ stopId }: { stopId: string | null }) => useArrivalsQuery(stopId),
      { initialProps: { stopId: 'sol-antigua:3' as string | null } },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    rerender({ stopId: null });
    expect(result.current.state).toBe('idle');
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
