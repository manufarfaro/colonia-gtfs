import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanQuery, type PlanInput } from './usePlanQuery';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Pin the wall clock so the request body's date/time is deterministic.
  // Fake ONLY Date so the request body's date/time is deterministic.
  // Faking setTimeout/setInterval breaks RTL's `waitFor`.
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
    const { result } = renderHook(() => usePlanQuery(null, toPlace));
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-06 idle → loading → success on a valid 200 response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [{ durationSeconds: 1 }] }));
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace));
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.itineraries).toHaveLength(1);
  });

  it('R-06 idle → loading → error(otp) on 502', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('otp_unavailable');
  });

  it('R-06 idle → loading → error(invalid) on 400', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_request' }, 400));
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('invalid_request');
  });

  it('R-06 idle → loading → error(empty) on 200 with no itineraries', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [] }));
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('empty');
  });

  it('R-06 idle → loading → error(network) on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'TypeError' }));
    const { result } = renderHook(() => usePlanQuery(fromPlace, toPlace));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-06 cancels the in-flight request when inputs change before resolution', async () => {
    // First fetch never resolves until abort fires.
    let abortReceived = false;
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          abortReceived = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [{ durationSeconds: 2 }] }));

    const { result, rerender } = renderHook(
      ({ from, to }: { from: PlanInput['from'] | null; to: PlanInput['to'] | null }) =>
        usePlanQuery(from, to),
      { initialProps: { from: fromPlace, to: toPlace } },
    );
    expect(result.current.state).toBe('loading');

    // Mutate the input; the previous request must abort and a new one fire.
    rerender({ from: { lat: -34.46, lon: -57.85 }, to: toPlace });

    await waitFor(() => {
      expect(abortReceived).toBe(true);
      expect(result.current.state).toBe('success');
    });
    expect(result.current.data?.itineraries[0].durationSeconds).toBe(2);
  });

  it('R-06 sends the request body with from/to + date+time anchored to Montevideo', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ itineraries: [{}] }));
    renderHook(() => usePlanQuery(fromPlace, toPlace));
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
    const { result, rerender } = renderHook(
      ({ from, to }: { from: PlanInput['from'] | null; to: PlanInput['to'] | null }) =>
        usePlanQuery(from, to),
      { initialProps: { from: fromPlace, to: toPlace } },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    act(() => {
      rerender({ from: fromPlace, to: null });
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.data).toBeNull();
  });
});
