// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadMiddleware(env: Record<string, string | undefined>): Promise<{
  middleware: (req: Request) => Response | Promise<Response>;
}> {
  const previous = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  const mod = await import('./middleware');
  Object.assign(process.env, previous);
  return mod;
}

function apiReq(origin?: string): Request {
  const h = new Headers();
  if (origin) h.set('Origin', origin);
  return new Request('http://localhost/api/plan', { headers: h });
}

describe('viewer CORS middleware', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.resetModules());

  it('R-12 empty VIEWER_CORS_ORIGINS → no CORS header', async () => {
    const { middleware } = await loadMiddleware({ VIEWER_CORS_ORIGINS: '' });
    const res = await middleware(apiReq('http://example.com'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('R-12 allowlisted origin → header echoed', async () => {
    const { middleware } = await loadMiddleware({ VIEWER_CORS_ORIGINS: 'http://localhost:3000' });
    const res = await middleware(apiReq('http://localhost:3000'));
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('R-12 non-allowlisted origin → no header', async () => {
    const { middleware } = await loadMiddleware({ VIEWER_CORS_ORIGINS: 'http://localhost:3000' });
    const res = await middleware(apiReq('http://attacker.example'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('R-12 wildcard "*" → no CORS header (warning only)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { middleware } = await loadMiddleware({ VIEWER_CORS_ORIGINS: '*' });
    const res = await middleware(apiReq('http://example.com'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('R-12 whitespace-only origin → no CORS header (trims to empty)', async () => {
    const { middleware } = await loadMiddleware({ VIEWER_CORS_ORIGINS: '   ' });
    const res = await middleware(apiReq('http://example.com'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('R-12 undefined env var → no CORS header (default path)', async () => {
    const { middleware } = await loadMiddleware({ VIEWER_CORS_ORIGINS: undefined });
    const res = await middleware(apiReq('http://example.com'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
