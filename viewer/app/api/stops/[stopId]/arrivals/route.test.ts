import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/test/fixtures/otp/arrivals-response.json';

const mockPost = vi.fn();
vi.mock('axios', () => ({ default: { create: () => ({ post: mockPost }) } }));

async function loadHandler(): Promise<{
  GET: (req: Request, ctx: { params: Promise<{ stopId: string }> }) => Promise<Response>;
}> {
  const mod = await import('./route');
  return mod;
}

function req(path = ''): Request {
  return new Request(`http://localhost/api/stops/sol-antigua:3/arrivals${path}`);
}

describe('GET /api/stops/:stopId/arrivals', () => {
  beforeEach(() => mockPost.mockReset());
  afterEach(() => vi.resetModules());

  it('R-05 returns 200 with merged scheduled+realtime arrivals', async () => {
    mockPost.mockResolvedValueOnce({ data: fixture });
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ stopId: 'sol-antigua:3' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stop.id).toBe('sol-antigua:3');
    expect(body.arrivals.length).toBe(2);
    expect(body.meta.realtime_available).toBe(true);
  });

  it('R-05 returns 404 when OTP cannot resolve the stop', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { stop: null } } });
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ stopId: 'missing' }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('stop_not_found');
  });

  it('R-05 returns 502 when OTP rejects, sanitized (no URL)', async () => {
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error('ECONNREFUSED'), {
        isAxiosError: true,
        config: { url: 'http://otp:8080/otp/gtfs/v1' },
      }),
    );
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ stopId: 'sol-antigua:3' }) });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('otp_unavailable');
    expect(JSON.stringify(body)).not.toContain('otp:8080');
  });

  it('R-05 honors ?limit query (default 10, clamped)', async () => {
    mockPost.mockResolvedValueOnce({ data: fixture });
    const { GET } = await loadHandler();
    await GET(req('?limit=5'), { params: Promise.resolve({ stopId: 'sol-antigua:3' }) });
    expect(mockPost).toHaveBeenCalledWith(
      '/otp/gtfs/v1',
      expect.objectContaining({
        variables: expect.objectContaining({ limit: 5 }),
      }),
    );
  });
});
