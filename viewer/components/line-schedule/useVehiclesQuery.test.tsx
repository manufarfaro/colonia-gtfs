import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVehiclesQuery } from './useVehiclesQuery';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const okBody = {
  lineId: '4',
  vehicles: [
    { id: 'L4-001', label: 'L4', routeId: '4', directionId: 0, lat: -34.47, lon: -57.85, bearing: 90, timestamp: 1779296445 },
  ],
  meta: { realtime_available: true, feed_timestamp: 1779296445 },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useVehiclesQuery', () => {
  it('R-07 stays idle when shortName is null', () => {
    const { result } = renderHook(() => useVehiclesQuery(null));
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-07 idle → loading → success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { result } = renderHook(() => useVehiclesQuery('4'));
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.vehicles).toHaveLength(1);
  });

  it('R-07 success with empty vehicles array (bridge down per spec R-07)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ lineId: '4', vehicles: [], meta: { realtime_available: false, feed_timestamp: null } }),
    );
    const { result } = renderHook(() => useVehiclesQuery('4'));
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.vehicles).toHaveLength(0);
    expect(result.current.data?.meta.realtime_available).toBe(false);
  });

  it('R-07 error.network on fetch reject', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useVehiclesQuery('4'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-07 polls at 15s cadence via setInterval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { unmount } = renderHook(() => useVehiclesQuery('4'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
    // Manually trigger the interval callback to simulate a tick.
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const cb = setIntervalSpy.mock.calls[0][0] as () => void;
    cb();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    unmount();
    setIntervalSpy.mockRestore();
  });

  it('R-07 switching shortName aborts previous + restarts poll', async () => {
    let receivedAbort = false;
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          receivedAbort = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...okBody, lineId: '5' }));
    const { result, rerender } = renderHook(
      ({ s }: { s: string | null }) => useVehiclesQuery(s),
      { initialProps: { s: '4' as string | null } },
    );
    expect(result.current.state).toBe('loading');
    rerender({ s: '5' });
    await waitFor(() => {
      expect(receivedAbort).toBe(true);
      expect(result.current.state).toBe('success');
    });
    expect(result.current.data?.lineId).toBe('5');
  });

  it('R-07 unmount aborts + clears interval', async () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { unmount } = renderHook(() => useVehiclesQuery('4'));
    await waitFor(() => expect(result(fetchMock)).toBeGreaterThan(0));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

function result(fn: ReturnType<typeof vi.fn>): number {
  return fn.mock.calls.length;
}
