import type { NextRequest } from 'next/server';

function parseAllowedOrigins(): string[] {
  const raw = (process.env.VIEWER_CORS_ORIGINS ?? '').trim();
  if (!raw) return [];
  if (raw === '*') {
    console.warn(
      '[viewer] VIEWER_CORS_ORIGINS="*" ignored — wildcard is not honored in production. Set explicit origins.',
    );
    return [];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

const allowed = parseAllowedOrigins();

export function middleware(req: NextRequest | Request): Response {
  const headers = new Headers({ 'x-middleware-next': '1' });
  const origin = req.headers.get('origin');
  if (origin && allowed.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'origin');
  }
  return new Response(null, { headers });
}

export const config = {
  matcher: ['/api/:path*'],
};
