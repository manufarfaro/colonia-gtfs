import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeQueryWrapper } from '@/test/query-test-wrapper';
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
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useVehiclesQuery(null), { wrapper: Wrapper });
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-07 idle → loading → success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useVehiclesQuery('4'), { wrapper: Wrapper });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.vehicles).toHaveLength(1);
  });

  it('R-07 success with empty vehicles array (bridge down per viewer-shell-and-api R-07)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ lineId: '4', vehicles: [], meta: { realtime_available: false, feed_timestamp: null } }),
    );
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useVehiclesQuery('4'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.vehicles).toHaveLength(0);
    expect(result.current.data?.meta.realtime_available).toBe(false);
  });

  it('R-07 error.network on fetch reject', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useVehiclesQuery('4'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-07 switching shortName triggers a fresh fetch with the new id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...okBody, lineId: '5' }));
    const { Wrapper } = makeQueryWrapper();
    const { result, rerender } = renderHook(
      ({ s }: { s: string | null }) => useVehiclesQuery(s),
      { initialProps: { s: '4' as string | null }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    rerender({ s: '5' });
    await waitFor(() => expect(result.current.data?.lineId).toBe('5'));
    expect(fetchMock.mock.calls[1][0]).toContain('/api/lines/5/vehicles');
  });

  it('R-07 keeps showing the last non-empty vehicles when a refetch returns empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ lineId: '4', vehicles: [], meta: { realtime_available: true, feed_timestamp: 0 } }),
    );
    const { Wrapper, client } = makeQueryWrapper();
    const { result } = renderHook(() => useVehiclesQuery('4'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.vehicles).toHaveLength(1));
    // Trigger a refetch on the same query key — the new response has
    // empty vehicles but the stale-hold window keeps the previous data.
    await client.invalidateQueries({ queryKey: ['vehicles', '4'] });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.data?.vehicles).toHaveLength(1);
  });

  it('R-07 clears the stale-hold cache when shortName changes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ lineId: '5', vehicles: [], meta: { realtime_available: true, feed_timestamp: 0 } }),
    );
    const { Wrapper } = makeQueryWrapper();
    const { result, rerender } = renderHook(
      ({ s }: { s: string | null }) => useVehiclesQuery(s),
      { initialProps: { s: '4' as string | null }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.data?.vehicles).toHaveLength(1));
    rerender({ s: '5' });
    // Different line — cache reset, empty response returns empty (no
    // bleed-through from line 4's data).
    await waitFor(() => expect(result.current.data?.lineId).toBe('5'));
    expect(result.current.data?.vehicles).toHaveLength(0);
  });

  it('R-07 stopping (shortName=null) resets the hook back to idle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okBody));
    const { Wrapper } = makeQueryWrapper();
    const { result, rerender } = renderHook(
      ({ s }: { s: string | null }) => useVehiclesQuery(s),
      { initialProps: { s: '4' as string | null }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    rerender({ s: null });
    expect(result.current.state).toBe('idle');
  });
});
