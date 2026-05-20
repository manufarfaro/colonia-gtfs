import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('axios', () => ({
  default: { create: () => ({ get: mockGet }), AxiosError: class AxiosError extends Error {} },
  AxiosError: class AxiosError extends Error {},
}));

const fixturePath = resolve(__dirname, '../../../../../test/fixtures/bridge/vehicle-positions.pb');
const pb = readFileSync(fixturePath);

async function loadHandler(): Promise<{
  GET: (req: Request, ctx: { params: Promise<{ lineId: string }> }) => Promise<Response>;
}> {
  return await import('./route');
}

function req(): Request {
  return new Request('http://localhost/api/lines/4/vehicles');
}

describe('GET /api/lines/:lineId/vehicles', () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.resetModules());

  it('R-07 returns 200 with vehicles filtered by line', async () => {
    mockGet.mockResolvedValueOnce({ data: pb.buffer.slice(pb.byteOffset, pb.byteOffset + pb.byteLength) });
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lineId).toBe('4');
    expect(body.vehicles.length).toBe(2);
    expect(body.meta.realtime_available).toBe(true);
  });

  it('R-07 bridge unreachable → 200 with empty vehicles + realtime_available:false', async () => {
    mockGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicles).toEqual([]);
    expect(body.meta.realtime_available).toBe(false);
  });

  it('R-07 every call hits bridge (no cache)', async () => {
    mockGet.mockResolvedValue({ data: pb.buffer.slice(pb.byteOffset, pb.byteOffset + pb.byteLength) });
    const { GET } = await loadHandler();
    await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('R-07 no bridge URL appears in response body when bridge fails', async () => {
    mockGet.mockRejectedValueOnce(
      Object.assign(new Error('ECONNREFUSED'), { config: { url: 'http://bridge:3001/api/v1/gtfs-rt/vehicle-positions.pb' } }),
    );
    const { GET } = await loadHandler();
    const res = await GET(req(), { params: Promise.resolve({ lineId: '4' }) });
    const body = await res.text();
    expect(body).not.toContain('bridge:3001');
  });
});
