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
  private options: RedisCacheOptions;

  constructor(options: RedisCacheOptions = {}) {
    this.options = options;
    this.keyPrefix = options.keyPrefix ?? "";
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    const { default: Redis } = await import("ioredis");
    this.client = new Redis({
      host: this.options.host ?? "localhost",
      port: this.options.port ?? 6379,
      password: this.options.password,
      db: this.options.db ?? 0
    });
    return this.client;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const client = await this.getClient();
    const value = await client.get(this.prefix(key));
    if (value == null) return undefined;
    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    const client = await this.getClient();
    await client.setex(this.prefix(key), ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.prefix(key));
  }

  async clear(): Promise<void> {
    const client = await this.getClient();
    const stream = client.scanStream({ match: `${this.keyPrefix}*` });
    const pipeline = client.pipeline();
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
