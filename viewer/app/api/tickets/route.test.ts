import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/tickets (stub)', () => {
  it('R-09 returns 501 not_implemented', async () => {
    const res = GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('not_implemented');
    expect(body.detail).toMatch(/tickets/i);
  });
});
