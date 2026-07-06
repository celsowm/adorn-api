import type { CacheProvider } from "./cache";

export interface RedisCacheOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export class RedisCacheProvider implements CacheProvider {
  private client: any;
  private keyPrefix: string;

  constructor(options: RedisCacheOptions = {}) {
    this.keyPrefix = options.keyPrefix ?? "";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis");
    this.client = new Redis({
      host: options.host ?? "localhost",
      port: options.port ?? 6379,
      password: options.password,
      db: options.db ?? 0
    });
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const value = await this.client.get(this.prefix(key));
    if (value == null) return undefined;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    await this.client.setex(this.prefix(key), ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.prefix(key));
  }

  async clear(): Promise<void> {
    const stream = this.client.scanStream({ match: `${this.keyPrefix}*` });
    const pipeline = this.client.pipeline();
    for await (const keys of stream) {
      if (keys.length) {
        pipeline.del(keys);
      }
    }
    await pipeline.exec();
  }

  private prefix(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}${key}` : key;
  }
}
