import axios, { type AxiosInstance } from 'axios';

/**
 * Error wrap: axios surfaces the URL via `config.url`. We strip it
 * before re-throwing so the OTP URL never reaches a log appender or a
 * REST response (R-04 sanitization).
 */
export class OtpUnavailableError extends Error {
  constructor(public readonly cause: 'timeout' | 'http_error' | 'network' | 'unknown') {
    super(`OTP upstream unavailable: ${cause}`);
    this.name = 'OtpUnavailableError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

let cached: AxiosInstance | null = null;

function client(): AxiosInstance {
  if (!cached) {
    cached = axios.create({
      baseURL: process.env.OTP_BASE_URL ?? 'http://otp:8080',
      timeout: DEFAULT_TIMEOUT_MS,
      headers: { 'content-type': 'application/json' },
    });
  }
  return cached;
}

/** Internal — let tests reset the cached client when needed. */
export function _resetClientForTests(): void {
  cached = null;
}

export interface GraphQLPayload {
  query: string;
  variables?: Record<string, unknown>;
}

export interface OtpQueryResult<T> {
  data: T;
  latencyMs: number;
}

export async function queryOtp<T>(payload: GraphQLPayload): Promise<OtpQueryResult<T>> {
  const start = Date.now();
  try {
    const res = await client().post('/otp/gtfs/v1', payload);
    return { data: res.data as T, latencyMs: Date.now() - start };
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

function wrapAxiosError(err: unknown): OtpUnavailableError {
  const e = err as {
    isAxiosError?: boolean;
    code?: string;
    response?: { status: number };
  };
  if (e?.isAxiosError) {
    if (e.code === 'ECONNABORTED') return new OtpUnavailableError('timeout');
    if (e.response?.status !== undefined) return new OtpUnavailableError('http_error');
    return new OtpUnavailableError('network');
  }
  return new OtpUnavailableError('unknown');
}
