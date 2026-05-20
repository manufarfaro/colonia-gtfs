import { describe, expect, it } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('returns cached value within TTL', () => {
    let now = 1000;
    const clock = () => now;
    const cache = new TtlCache<string, number>(60_000, clock);

    cache.set('k', 42);
    now = 50_000;
    expect(cache.get('k')).toBe(42);
  });

  it('evicts after TTL expires', () => {
    let now = 1000;
    const clock = () => now;
    const cache = new TtlCache<string, number>(60_000, clock);

    cache.set('k', 42);
    now = 1000 + 60_001;
    expect(cache.get('k')).toBeUndefined();
  });

  it('returns undefined for missing key', () => {
    const cache = new TtlCache<string, number>(60_000, () => 0);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('getOrCompute calls factory once within TTL', async () => {
    let now = 0;
    const clock = () => now;
    const cache = new TtlCache<string, string>(60_000, clock);
    let calls = 0;
    const factory = async () => {
      calls++;
      return 'value';
    };

    expect(await cache.getOrCompute('k', factory)).toBe('value');
    now = 30_000;
    expect(await cache.getOrCompute('k', factory)).toBe('value');
    expect(calls).toBe(1);
  });

  it('getOrCompute calls factory again after TTL', async () => {
    let now = 0;
    const clock = () => now;
    const cache = new TtlCache<string, string>(60_000, clock);
    let calls = 0;
    const factory = async () => {
      calls++;
      return `v${calls}`;
    };

    expect(await cache.getOrCompute('k', factory)).toBe('v1');
    now = 61_000;
    expect(await cache.getOrCompute('k', factory)).toBe('v2');
    expect(calls).toBe(2);
  });
});
