import { LRUCache } from "lru-cache";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- LRUCache V 参数约束要求 extends {}
const cache = new LRUCache<string, {}>({
  max: 2000,
  ttl: 5 * 60 * 1000,
});

export function memGet<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function memSet<T>(key: string, value: T, ttlMs?: number): void {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  cache.set(key, value as {}, ttlMs ? { ttl: ttlMs } : undefined);
}

export function memDelete(key: string): void {
  cache.delete(key);
}

/**
 * 删除匹配前缀的所有键。
 * LRU 遍历复杂度 O(n)，但 max=2000 完全可以接受。
 */
export function memDeletePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * 进程内 getOrSet：先读内存缓存 → 未命中调 fetcher → 写入缓存。
 * 内置 singleflight 防止并发回源。
 */
export async function memGetOrSet<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
  const cached = memGet<T>(key);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fetcher()
    .then((result) => {
      memSet(key, result, ttlMs);
      return result;
    })
    .finally(() => {
      if (inflight.get(key) === promise) {
        inflight.delete(key);
      }
    });

  inflight.set(key, promise);
  return promise;
}
