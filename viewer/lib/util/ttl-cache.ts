export type Clock = () => number;

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly clock: Clock = () => Date.now(),
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.clock() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { value, expiresAt: this.clock() + this.ttlMs });
  }

  async getOrCompute(key: K, factory: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await factory();
    this.set(key, value);
    return value;
  }
}
