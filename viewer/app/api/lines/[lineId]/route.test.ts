import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/test/fixtures/otp/line-response.json';

const mockPost = vi.fn();
vi.mock('axios', () => ({ default: { create: () => ({ post: mockPost }) } }));

async function loadHandler(): Promise<{
  GET: (req: Request, ctx: { params: Promise<{ lineId: string }> }) => Promise<Response>;
}> {
  return await import('./route');
}

function req(): Request {
  return new Request('http://localhost/api/lines/4');
}

describe('GET /api/lines/:lineId', () => {
  beforeEach(() => {
    mockPost.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.resetModules());

  it('R-06 returns 200 with line + shape + directions', async () => {
    mockPost.mockResolvedValueOnce({ data: fixture });
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.line.shortName).toBe('4');
    expect(body.directions.length).toBe(2);
    expect(body.shape.length).toBe(2);
  });

  it('R-06 returns 404 when OTP returns no matching routes', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { routes: [] } } });
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ lineId: 'missing' }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('line_not_found');
  });

  it('R-06 returns 502 sanitized when OTP fails', async () => {
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        config: { url: 'http://otp:8080/otp/gtfs/v1' },
      }),
    );
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('otp:8080');
  });

  it('R-06 re-throws non-OTP errors (translator failure propagates to Next)', async () => {
    // Poison: patterns is a string on the matched route — `.map` throws.
    mockPost.mockResolvedValueOnce({
      data: {
        data: { routes: [{ gtfsId: '1:4', shortName: '4', longName: 'L4', patterns: 'nope' }] },
      },
    });
    const { GET } = await loadHandler();
    await expect(
      GET(req(), { params: Promise.resolve({ lineId: '4' }) }),
    ).rejects.toThrow(TypeError);
  });

  it('R-06 caches within TTL: two consecutive calls hit OTP once', async () => {
    mockPost.mockResolvedValueOnce({ data: fixture });
    const { GET } = await loadHandler();
    await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
