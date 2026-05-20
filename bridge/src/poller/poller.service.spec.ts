import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { of, throwError } from 'rxjs';
import { GtfsStaticService } from '../gtfs/gtfs-static.service';
import { MatcherService } from '../matcher/matcher.service';
import {
  PollerService,
  PollerConfig,
  HttpPollError,
  PollTimeoutError,
  PollNetworkError,
} from './poller.service';

const FIXTURE_DIR = path.resolve(__dirname, '../../test/fixtures/gtfs-mini');
const AVL_MINI = path.resolve(__dirname, '../../test/fixtures/avl-mini.xml');

// We use a controllable HttpService double — only `.get(url, opts)` is needed.
interface FakeHttp {
  get: jest.Mock;
}

function fakeHttp(): FakeHttp {
  return { get: jest.fn() };
}

async function buildPoller(opts: {
  http: FakeHttp;
  config?: Partial<PollerConfig>;
}): Promise<PollerService> {
  const gtfs = new GtfsStaticService(FIXTURE_DIR);
  await gtfs.onModuleInit();
  const matcher = new MatcherService(gtfs);
  const config: PollerConfig = {
    originUrl: 'http://operator.test/avl.xml',
    pollIntervalMs: 30_000,
    timeoutMs: 10_000,
    ...(opts.config ?? {}),
  };
  // Cast: only `.get` is exercised. NestJS HttpService wraps axios so this
  // narrows to what we need.
  return new PollerService(opts.http as unknown as { get: typeof opts.http.get }, matcher, config);
}

describe('PollerService backoff math', () => {
  it('R-04 returns base interval on 0 consecutive failures', async () => {
    const poller = await buildPoller({ http: fakeHttp() });
    expect(poller.computeNextDelayMs(0)).toBe(30_000);
  });

  it('R-04 walks 60→120→240→300 s for failure counts 1..4', async () => {
    const poller = await buildPoller({ http: fakeHttp() });
    expect(poller.computeNextDelayMs(1)).toBe(60_000);
    expect(poller.computeNextDelayMs(2)).toBe(120_000);
    expect(poller.computeNextDelayMs(3)).toBe(240_000);
    expect(poller.computeNextDelayMs(4)).toBe(300_000);
  });

  it('R-04 caps at 300 s for failure counts beyond the schedule length', async () => {
    const poller = await buildPoller({ http: fakeHttp() });
    expect(poller.computeNextDelayMs(5)).toBe(300_000);
    expect(poller.computeNextDelayMs(50)).toBe(300_000);
  });
});

describe('PollerService.pollOnce — fixture mode', () => {
  it('R-04 reads from disk when originUrl is file://', async () => {
    const http = fakeHttp(); // Should never be called.
    const poller = await buildPoller({
      http,
      config: { originUrl: `file://${AVL_MINI}` },
    });
    const result = await poller.pollOnce();
    expect(result.ok).toBe(true);
    expect(http.get).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.markersCount).toBe(2);
    }
  });
});

describe('PollerService.pollOnce — error wrapping', () => {
  it('R-03 wraps AxiosError with `response.status` as HttpPollError without the URL in the message', async () => {
    const http = fakeHttp();
    const axiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'Request failed with status code 502 for http://operator.test/avl.xml',
      response: { status: 502, data: {}, headers: {} },
      config: { url: 'http://operator.test/avl.xml' },
    };
    http.get.mockReturnValue(throwError(() => axiosError));
    const poller = await buildPoller({ http });
    const result = await poller.pollOnce();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(HttpPollError);
      expect(result.error.message).not.toContain('operator.test');
      expect((result.error as HttpPollError).status).toBe(502);
    }
  });

  it('R-03 wraps AxiosError timeouts as PollTimeoutError without the URL', async () => {
    const http = fakeHttp();
    const axiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'timeout of 10000ms exceeded for http://operator.test/avl.xml',
      code: 'ECONNABORTED',
      config: { url: 'http://operator.test/avl.xml' },
    };
    http.get.mockReturnValue(throwError(() => axiosError));
    const poller = await buildPoller({ http });
    const result = await poller.pollOnce();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PollTimeoutError);
      expect(result.error.message).not.toContain('operator.test');
    }
  });

  it('R-03 wraps non-response AxiosError (network down) as PollNetworkError without the URL', async () => {
    const http = fakeHttp();
    const axiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'getaddrinfo ENOTFOUND operator.test',
      code: 'ENOTFOUND',
      config: { url: 'http://operator.test/avl.xml' },
    };
    http.get.mockReturnValue(throwError(() => axiosError));
    const poller = await buildPoller({ http });
    const result = await poller.pollOnce();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PollNetworkError);
      expect(result.error.message).not.toContain('operator.test');
    }
  });
});

describe('PollerService.pollOnce — successful HTTP path', () => {
  it('R-04 produces a snapshot from successful response (markers parsed + matched)', async () => {
    const buf = await fs.readFile(AVL_MINI);
    const http = fakeHttp();
    http.get.mockReturnValue(of({ data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }));
    const poller = await buildPoller({ http });
    const result = await poller.pollOnce();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markersCount).toBe(2);
      // Snapshot updated.
      const snap = poller.getSnapshot();
      expect(snap.lastSuccessTs).not.toBeNull();
      expect(snap.markersCount).toBe(2);
      expect(snap.consecutiveFailures).toBe(0);
    }
  });

  it('R-04 increments consecutiveFailures on error, resets on success', async () => {
    const http = fakeHttp();
    http.get.mockReturnValueOnce(throwError(() => ({ isAxiosError: true, code: 'ECONNABORTED', config: { url: 'http://x' } })));
    const poller = await buildPoller({ http });
    const fail = await poller.pollOnce();
    expect(fail.ok).toBe(false);
    expect(poller.getSnapshot().consecutiveFailures).toBe(1);

    const buf = await fs.readFile(AVL_MINI);
    http.get.mockReturnValueOnce(of({ data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }));
    const ok = await poller.pollOnce();
    expect(ok.ok).toBe(true);
    expect(poller.getSnapshot().consecutiveFailures).toBe(0);
  });
});
