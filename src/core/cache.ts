export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl: number;
  /** Optional fixed key prefix (defaults to method:path) */
  key?: string;
  /** Parameter names to include in the cache key (e.g. ["id"]) */
  paramKeys?: string[];
  /** Custom function to determine if the result should be cached */
  condition?: (result: unknown) => boolean;
}

export interface CacheProvider {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryCacheProvider implements CacheProvider {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
