import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('axios', () => ({
  default: { create: () => ({ get: mockGet }) },
}));

async function loadHandler(): Promise<{ GET: () => Promise<Response> }> {
  return await import('./route');
}

describe('GET /api/healthz', () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.resetModules());

  it('R-10 status ok when both OTP and bridge healthy', async () => {
    mockGet
      .mockResolvedValueOnce({ status: 200, data: 'ok' })
      .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
    const { GET } = await loadHandler();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.otp.reachable).toBe(true);
    expect(body.bridge.reachable).toBe(true);
    expect(body.viewer.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('R-10 status degraded when bridge unreachable but OTP ok', async () => {
    mockGet
      .mockResolvedValueOnce({ status: 200, data: 'ok' })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { GET } = await loadHandler();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.otp.reachable).toBe(true);
    expect(body.bridge.reachable).toBe(false);
  });

  it('R-10 status down when OTP unreachable', async () => {
    mockGet
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
    const { GET } = await loadHandler();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('down');
    expect(body.otp.reachable).toBe(false);
  });

  it('R-10 status down when both unreachable', async () => {
    mockGet
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { GET } = await loadHandler();
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('down');
  });

  it('R-10 includes viewer.next_version', async () => {
    mockGet.mockResolvedValue({ status: 200, data: 'ok' });
    const { GET } = await loadHandler();
    const body = await (await GET()).json();
    expect(body.viewer.next_version).toBeTypeOf('string');
    expect(body.viewer.next_version.length).toBeGreaterThan(0);
  });
});
