import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLineQuery } from './useLineQuery';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const okBody = {
  line: { id: '1:4', shortName: '4', longName: 'Línea 4' },
  shape: [],
  directions: [],
  meta: { date: '2026-05-20' },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useLineQuery', () => {
  it('R-06 stays idle when shortName is null', () => {
    const { result } = renderHook(() => useLineQuery(null));
    expect(result.current.state).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('R-06 idle → loading → success on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));
    const { result } = renderHook(() => useLineQuery('4'));
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(result.current.data?.line?.shortName).toBe('4');
  });

  it('R-06 error.not_found on 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'line_not_found' }, 404));
    const { result } = renderHook(() => useLineQuery('missing'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('not_found');
  });

  it('R-06 error.otp on 502', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'otp_unavailable' }, 502));
    const { result } = renderHook(() => useLineQuery('4'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('otp_unavailable');
  });

  it('R-06 error.network on fetch reject', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLineQuery('4'));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('network');
  });

  it('R-06 re-fetches when shortName changes (and only when it changes)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(okBody));
    const { result, rerender } = renderHook(
      ({ s }: { s: string | null }) => useLineQuery(s),
      { initialProps: { s: '4' as string | null } },
    );
    await waitFor(() => expect(result.current.state).toBe('success'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ s: '4' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ s: '5' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('R-06 unmount aborts in-flight', async () => {
    let receivedAbort = false;
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          receivedAbort = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const { unmount } = renderHook(() => useLineQuery('4'));
    unmount();
    await waitFor(() => expect(receivedAbort).toBe(true));
  });
});
