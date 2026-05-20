import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
class FakeAxiosError extends Error {
  isAxiosError = true;
  code?: string;
  response?: unknown;
  constructor(message: string, init: { code?: string; response?: unknown } = {}) {
    super(message);
    this.code = init.code;
    this.response = init.response;
  }
}

vi.mock('axios', () => ({
  default: { create: () => ({ get: mockGet }), AxiosError: FakeAxiosError },
  AxiosError: FakeAxiosError,
}));

async function loadClient(): Promise<typeof import('./client')> {
  return await import('./client');
}

describe('bridge client error wrapping', () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.resetModules());

  it('R-07 returns Uint8Array on success', async () => {
    const buf = new ArrayBuffer(4);
    mockGet.mockResolvedValueOnce({ data: buf });
    const { fetchVehiclePositions } = await loadClient();
    const result = await fetchVehiclePositions();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(4);
  });

  it('R-07 wraps ECONNABORTED into BridgeUnavailableError(timeout)', async () => {
    mockGet.mockRejectedValueOnce(new FakeAxiosError('aborted', { code: 'ECONNABORTED' }));
    const { fetchVehiclePositions, BridgeUnavailableError } = await loadClient();
    try {
      await fetchVehiclePositions();
      expect.fail('expected BridgeUnavailableError');
    } catch (err) {
      expect(err).toBeInstanceOf(BridgeUnavailableError);
      expect((err as InstanceType<typeof BridgeUnavailableError>).cause).toBe('timeout');
    }
  });

  it('R-07 wraps ETIMEDOUT into BridgeUnavailableError(timeout)', async () => {
    mockGet.mockRejectedValueOnce(new FakeAxiosError('timeout', { code: 'ETIMEDOUT' }));
    const { fetchVehiclePositions, BridgeUnavailableError } = await loadClient();
    await expect(fetchVehiclePositions()).rejects.toMatchObject({
      constructor: BridgeUnavailableError,
      cause: 'timeout',
    });
  });

  it('R-07 wraps HTTP error response into BridgeUnavailableError(http_error)', async () => {
    mockGet.mockRejectedValueOnce(new FakeAxiosError('500', { response: { status: 500 } }));
    const { fetchVehiclePositions, BridgeUnavailableError } = await loadClient();
    await expect(fetchVehiclePositions()).rejects.toMatchObject({
      constructor: BridgeUnavailableError,
      cause: 'http_error',
    });
  });

  it('R-07 wraps network failure into BridgeUnavailableError(network)', async () => {
    mockGet.mockRejectedValueOnce(new FakeAxiosError('econnrefused'));
    const { fetchVehiclePositions, BridgeUnavailableError } = await loadClient();
    await expect(fetchVehiclePositions()).rejects.toMatchObject({
      constructor: BridgeUnavailableError,
      cause: 'network',
    });
  });

  it('R-07 wraps non-axios errors into BridgeUnavailableError(unknown)', async () => {
    mockGet.mockRejectedValueOnce(new Error('something went wrong'));
    const { fetchVehiclePositions, BridgeUnavailableError } = await loadClient();
    await expect(fetchVehiclePositions()).rejects.toMatchObject({
      constructor: BridgeUnavailableError,
      cause: 'unknown',
    });
  });

  it('R-07 reuses the cached axios instance across calls', async () => {
    const buf = new ArrayBuffer(0);
    mockGet.mockResolvedValue({ data: buf });
    const { fetchVehiclePositions } = await loadClient();
    await fetchVehiclePositions();
    await fetchVehiclePositions();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
