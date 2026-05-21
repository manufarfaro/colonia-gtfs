import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeQueryWrapper } from '@/test/query-test-wrapper';
import { usePlanQuery, type PlanInput } from './usePlanQuery';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Fake only Date for deterministic request body. setTimeout stays real
  // so RTL's `waitFor` and React Query's internal scheduling work.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-05-20T14:30:25Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const fromPlace: PlanInput['from'] = { lat: -34.471, lon: -57.852 };
const toPlace: PlanInput['to'] = { lat: -34.449, lon: -57.815 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('usePlanQuery', () => {
  it('R-06 stays idle while either endpoint is null', () => {
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePlanQuery(null, toPlace), { wrapper: Wrapper });
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-06 idle → loading → success on a valid 200 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [{ durationSeconds: 1 }] }));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace), { wrapper: Wrapper });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.itineraries).toHaveLength(1);
  });

  it('R-06 idle → loading → error(otp) on 502', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('otp_unavailable');
  });

  it('R-06 idle → loading → error(invalid) on 400', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_request' }, 400));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('invalid_request');
  });

  it('R-06 idle → loading → error(empty) on 200 with no itineraries', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [] }));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('empty');
  });

  it('R-06 idle → loading → error(network) on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeQueryWrapper();
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-06 sends the request body with from/to + date+time anchored to Montevideo', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [{}] }));
    const { Wrapper } = makeQueryWrapper();
    renderHook(() => usePlanQuery(fromPlace, toPlace), { wrapper: Wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/plan');
    expect(init?.method).toBe('POST');
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body.from).toEqual(fromPlace);
    expect(body.to).toEqual(toPlace);
    expect(body.date).toBe('2026-05-20');
    expect(body.time).toBe('11:31');
  });

  it('R-06 transitions back to idle when an input becomes null after a result lands', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [{}] }));
    const { Wrapper } = makeQueryWrapper();
    const { result, rerender } = renderHook(
      ({ from, to }: { from: PlanInput['from'] | null; to: PlanInput['to'] | null }) =>
        usePlanQuery(from, to),
      { initialProps: { from: fromPlace, to: toPlace as PlanInput['to'] | null }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    rerender({ from: fromPlace, to: null });
    expect(result.current.state).toBe('idle');
    expect(result.current.data).toBeNull();
  });
});
