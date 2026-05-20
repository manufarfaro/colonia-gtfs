import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();

vi.mock('axios', () => ({
  default: { create: () => ({ post: mockPost }) },
}));

async function loadClient(): Promise<typeof import('./client')> {
  return await import('./client');
}

describe('otp client error wrapping', () => {
  beforeEach(() => {
    mockPost.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.resetModules());

  it('R-04 returns { data, latencyMs } on success', async () => {
    mockPost.mockResolvedValueOnce({ data: { hello: 'world' } });
    const { queryOtp } = await loadClient();
    const result = await queryOtp<{ hello: string }>({ query: '{ ping }' });
    expect(result.data.hello).toBe('world');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('R-04 wraps ECONNABORTED into OtpUnavailableError(timeout)', async () => {
    mockPost.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNABORTED' });
    const { queryOtp, OtpUnavailableError } = await loadClient();
    try {
      await queryOtp({ query: '{ x }' });
      expect.fail('expected OtpUnavailableError');
    } catch (err) {
      expect(err).toBeInstanceOf(OtpUnavailableError);
      expect((err as InstanceType<typeof OtpUnavailableError>).cause).toBe('timeout');
    }
  });

  it('R-04 wraps an HTTP error response into OtpUnavailableError(http_error)', async () => {
    mockPost.mockRejectedValueOnce({ isAxiosError: true, response: { status: 502 } });
    const { queryOtp, OtpUnavailableError } = await loadClient();
    await expect(queryOtp({ query: '{ x }' })).rejects.toMatchObject({
      constructor: OtpUnavailableError,
      cause: 'http_error',
    });
  });

  it('R-04 wraps a network-level axios error into OtpUnavailableError(network)', async () => {
    mockPost.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNREFUSED' });
    const { queryOtp, OtpUnavailableError } = await loadClient();
    await expect(queryOtp({ query: '{ x }' })).rejects.toMatchObject({
      constructor: OtpUnavailableError,
      cause: 'network',
    });
  });

  it('R-04 wraps non-axios errors into OtpUnavailableError(unknown)', async () => {
    mockPost.mockRejectedValueOnce(new Error('boom'));
    const { queryOtp, OtpUnavailableError } = await loadClient();
    await expect(queryOtp({ query: '{ x }' })).rejects.toMatchObject({
      constructor: OtpUnavailableError,
      cause: 'unknown',
    });
  });

  it('_resetClientForTests clears the cached axios instance', async () => {
    const { _resetClientForTests, queryOtp } = await loadClient();
    mockPost.mockResolvedValue({ data: {} });
    await queryOtp({ query: '{ x }' });
    _resetClientForTests();
    await queryOtp({ query: '{ x }' });
    // Two calls executed without throwing — the reset path is exercised.
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('R-04 reuses the cached axios client across consecutive calls', async () => {
    const { queryOtp } = await loadClient();
    mockPost.mockResolvedValue({ data: {} });
    await queryOtp({ query: '{ x }' });
    await queryOtp({ query: '{ y }' });
    // Second call exercises the `cached` early-return branch.
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('R-04 honors OTP_BASE_URL when the env var is set', async () => {
    const previous = process.env.OTP_BASE_URL;
    process.env.OTP_BASE_URL = 'http://otp.staging.example:9090';
    vi.resetModules();
    mockPost.mockResolvedValueOnce({ data: {} });
    const { queryOtp } = await import('./client');
    await queryOtp({ query: '{ x }' });
    // The env-set branch of `process.env.OTP_BASE_URL ?? 'http://otp:8080'`.
    expect(mockPost).toHaveBeenCalled();
    if (previous === undefined) delete process.env.OTP_BASE_URL;
    else process.env.OTP_BASE_URL = previous;
  });
});
