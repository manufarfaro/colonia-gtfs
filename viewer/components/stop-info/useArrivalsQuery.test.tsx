import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeQueryWrapper } from '@/test/query-test-wrapper';
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
  vi.unstubAllGlobals();
});

describe('useArrivalsQuery', () => {
  it('R-04 stays idle when stopId is null', () => {
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useArrivalsQuery(null), { wrapper: Wrapper });
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-04 idle → loading → success on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'), { wrapper: Wrapper });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.arrivals).toHaveLength(1);
  });

  it('R-04 idle → loading → error.empty on 200 with empty arrivals', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...okBody, arrivals: [] }));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('empty');
  });

  it('R-04 idle → loading → error.notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'stop_not_found' }, 404));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:missing'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('not_found');
  });

  it('R-04 idle → loading → error.otp on 502', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('otp_unavailable');
  });

  it('R-04 idle → loading → error.network on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => useArrivalsQuery('sol-antigua:3'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-04 switching stopId triggers a fresh fetch with the new id in the URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...okBody, stop: { ...okBody.stop, id: 'sol-antigua:7' } }));
    const { Wrapper } = makeQueryWrapper();
    const { result, rerender } = renderHook(
      ({ stopId }: { stopId: string | null }) => useArrivalsQuery(stopId),
      { initialProps: { stopId: 'sol-antigua:3' as string | null }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    rerender({ stopId: 'sol-antigua:7' });
    await waitFor(() => expect(result.current.data?.stop.id).toBe('sol-antigua:7'));
    // The 2nd fetch URL contains the new id.
    const lastUrl = fetchMock.mock.calls[1][0] as string;
    expect(lastUrl).toContain('sol-antigua%3A7');
  });

  it('R-04 stopping (stopId=null) resets the hook back to idle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okBody));
    const { Wrapper } = makeQueryWrapper();
    const { result, rerender } = renderHook(
      ({ stopId }: { stopId: string | null }) => useArrivalsQuery(stopId),
      { initialProps: { stopId: 'sol-antigua:3' as string | null }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    rerender({ stopId: null });
    expect(result.current.state).toBe('idle');
  });
});
