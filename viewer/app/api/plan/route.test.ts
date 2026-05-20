import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/test/fixtures/otp/plan-response.json' with { type: 'json' };

const mockPost = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({ post: mockPost }),
  },
}));

async function loadHandler(): Promise<(req: Request) => Promise<Response>> {
  const mod = await import('./route');
  return mod.POST;
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/plan', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('R-04 returns 200 with translated itineraries for a valid body', async () => {
    mockPost.mockResolvedValueOnce({ data: fixture });
    const POST = await loadHandler();
    const res = await POST(
      makeRequest({
        from: { lat: -34.4712, lon: -57.852 },
        to: { lat: -34.447, lon: -57.844 },
        date: '2026-06-02',
        time: '08:30',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.itineraries).toHaveLength(2);
    expect(body.itineraries[1].legs.find((l: { mode: string }) => l.mode === 'BUS')).toBeDefined();
    expect(body.meta).toHaveProperty('queriedAt');
    expect(body.meta).toHaveProperty('otpLatencyMs');
  });

  it('R-04 returns 400 when the body is missing required fields', async () => {
    const POST = await loadHandler();
    const res = await POST(makeRequest({ from: { lat: -34.47 } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
    expect(body.details).toBeDefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('R-04 returns 400 when the body is not valid JSON', async () => {
    const POST = await loadHandler();
    const req = new Request('http://localhost/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'this is not JSON',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
    expect(body.details).toContain('body must be JSON');
  });

  it('R-04 re-throws non-OTP errors (translator failure propagates to Next)', async () => {
    // Poison data: legs is a string, so it.legs.map(...) throws TypeError.
    // queryOtp succeeds; the translator throws; the route's defensive
    // catch sees a non-OtpUnavailableError and re-throws to Next.js.
    mockPost.mockResolvedValueOnce({
      data: { data: { plan: { itineraries: [{ duration: 1, walkDistance: 0, legs: 'not-an-array' }] } } },
    });
    const POST = await loadHandler();
    await expect(
      POST(
        makeRequest({
          from: { lat: -34.47, lon: -57.85 },
          to: { lat: -34.44, lon: -57.81 },
          date: '2026-06-02',
          time: '08:30',
        }),
      ),
    ).rejects.toThrow(TypeError);
  });

  it('R-04 returns 502 when OTP rejects, without surfacing the OTP URL in the body', async () => {
    const axiosErr = Object.assign(new Error('ECONNREFUSED'), {
      isAxiosError: true,
      config: { url: 'http://otp:8080/otp/gtfs/v1' },
    });
    mockPost.mockRejectedValueOnce(axiosErr);
    const POST = await loadHandler();
    const res = await POST(
      makeRequest({
        from: { lat: -34.47, lon: -57.85 },
        to: { lat: -34.44, lon: -57.81 },
        date: '2026-06-02',
        time: '08:30',
      }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('otp_unavailable');
    expect(JSON.stringify(body)).not.toContain('otp:8080');
  });
});
