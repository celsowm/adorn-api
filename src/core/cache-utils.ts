import type { CacheProvider } from "./cache";
import { InMemoryCacheProvider } from "./cache";
import type { RouteMeta } from "./metadata";

export function resolveCacheProvider(cache?: CacheProvider): CacheProvider {
  return cache ?? new InMemoryCacheProvider();
}

export function buildCacheKey(
  method: string,
  path: string,
  cacheOptions: { key?: string; paramKeys?: string[] },
  params?: Record<string, unknown>
): string {
  if (cacheOptions.key) {
    return `${method}:${cacheOptions.key}`;
  }

  if (cacheOptions.paramKeys && params) {
    const values = cacheOptions.paramKeys.map((k) => {
      const raw = params[k];
      return raw != null ? String(raw) : undefined;
    });
    const suffix = values.filter((v) => v != null).join(":");
    if (suffix) {
      return `${method}:${path}:${suffix}`;
    }
  }

  return `${method}:${path}`;
}

export function shouldCacheResult(
  condition: ((result: unknown) => boolean) | undefined,
  result: unknown
): boolean {
  if (!condition) return true;
  return condition(result);
}

export function isCacheableMethod(method: string): boolean {
  return ["get", "head"].includes(method.toLowerCase());
}

export function getCacheOptions(route: RouteMeta): { ttl: number; key?: string; paramKeys?: string[]; condition?: (result: unknown) => boolean } | undefined {
  return route.cache;
}
