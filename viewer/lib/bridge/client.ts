import axios, { AxiosError, type AxiosInstance } from 'axios';

const DEFAULT_TIMEOUT_MS = 5_000;

export class BridgeUnavailableError extends Error {
  constructor(public readonly cause: 'timeout' | 'http_error' | 'network' | 'unknown') {
    super('bridge_unavailable');
    this.name = 'BridgeUnavailableError';
  }
}

let cached: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (cached) return cached;
  const baseURL = process.env.BRIDGE_BASE_URL ?? 'http://bridge:3001';
  cached = axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT_MS,
    responseType: 'arraybuffer',
  });
  return cached;
}

export async function fetchVehiclePositions(): Promise<Uint8Array> {
  try {
    const { data } = await getClient().get('/gtfs-rt/vehicle-positions.pb');
    return new Uint8Array(data as ArrayBuffer);
  } catch (err) {
    if (err instanceof AxiosError) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        throw new BridgeUnavailableError('timeout');
      }
      if (err.response) throw new BridgeUnavailableError('http_error');
      throw new BridgeUnavailableError('network');
    }
    throw new BridgeUnavailableError('unknown');
  }
}
