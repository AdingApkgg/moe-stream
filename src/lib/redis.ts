import Redis from "ioredis";
import { env } from "@/env";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisErrorLogged: boolean | undefined;
};

const MAX_RECONNECT_ATTEMPTS = process.env.NODE_ENV === "production" ? Infinity : 5;

// 使用 WHATWG URL API 解析，避免 ioredis 内部调用已废弃的 url.parse()
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  };
}

export const redis =
  globalForRedis.redis ??
  new Redis({
    ...parseRedisUrl(env.REDIS_URL),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[Redis] 已达最大重连次数 (${MAX_RECONNECT_ATTEMPTS})，停止重连。缓存功能将降级为直接查询数据库。`);
        return null;
      }
      return Math.min(times * 500, 10000);
    },
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// 连接事件监控（避免重复日志刷屏）
redis.on("error", () => {
  if (!globalForRedis.redisErrorLogged) {
    globalForRedis.redisErrorLogged = true;
    console.warn("[Redis] 连接失败，缓存将降级。如需 Redis 请确保服务已启动。");
  }
});
redis.on("connect", () => {
  globalForRedis.redisErrorLogged = false;
  console.log("[Redis] Connected");
});
redis.on("reconnecting", () => {
  // 静默，不再重复打印
});

export default redis;

// ============================================================
// 缓存工具函数（所有操作均安全降级，Redis 故障不影响主流程）
// ============================================================

/**
 * 获取缓存，JSON 解析失败或 Redis 故障时返回 null
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`[Redis] getCache("${key}") error:`, err);
    return null;
  }
}

/**
 * 设置缓存，Redis 故障时静默跳过
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[Redis] setCache("${key}") error:`, err);
  }
}

/**
 * 缓存穿透保护：先读缓存，未命中时调用 fetcher 回源并写入缓存。
 * 内置 singleflight 防止缓存击穿（同一 key 并发请求只会触发一次 fetcher）。
 */
const inflightRequests = new Map<string, Promise<unknown>>();

export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // 1. 先尝试读缓存
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  // 2. singleflight：复用已有的 inflight 请求
  const inflight = inflightRequests.get(key) as Promise<T> | undefined;
  if (inflight) return inflight;

  // 3. 发起回源
  const promise = fetcher().then(async (result) => {
    await setCache(key, result, ttlSeconds);
    return result;
  }).finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, promise);
  return promise;
}

/**
 * 删除单个缓存键（精确删除，O(1) 复杂度）
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[Redis] deleteCache("${key}") error:`, err);
  }
}

/**
 * 批量删除精确键（使用 pipeline 提高性能）
 */
export async function deleteCacheKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }
    await pipeline.exec();
  } catch (err) {
    console.error(`[Redis] deleteCacheKeys error:`, err);
  }
}

/**
 * 使用 SCAN 命令删除匹配模式的缓存键
 * 相比 KEYS 命令，SCAN 不会阻塞 Redis 服务器
 *
 * ⚠️ 注意：如果你要删除的是确定的 key（非通配符），
 *    请使用 deleteCache() 或 deleteCacheKeys()，性能更好。
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    let cursor = "0";
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.del(key);
        }
        await pipeline.exec();
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (err) {
    console.error(`[Redis] deleteCachePattern("${pattern}") error:`, err);
    return 0;
  }
}

/**
 * 批量设置缓存（使用 pipeline 提高性能）
 */
export async function setCacheMultiple<T>(
  items: Array<{ key: string; value: T; ttl?: number }>
): Promise<void> {
  if (items.length === 0) return;
  try {
    const pipeline = redis.pipeline();
    for (const { key, value, ttl = 3600 } of items) {
      pipeline.set(key, JSON.stringify(value), "EX", ttl);
    }
    await pipeline.exec();
  } catch (err) {
    console.error("[Redis] setCacheMultiple error:", err);
  }
}

/**
 * 批量获取缓存（使用 mget 提高性能）
 */
export async function getCacheMultiple<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  try {
    const results = await redis.mget(...keys);
    return results.map((data) => {
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return null;
      }
    });
  } catch (err) {
    console.error("[Redis] getCacheMultiple error:", err);
    return keys.map(() => null);
  }
}

/**
 * 缓存键是否存在
 */
export async function hasCache(key: string): Promise<boolean> {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    console.error(`[Redis] hasCache("${key}") error:`, err);
    return false;
  }
}

/**
 * 获取缓存剩余 TTL（秒），出错返回 -2（等同于键不存在）
 */
export async function getCacheTTL(key: string): Promise<number> {
  try {
    return redis.ttl(key);
  } catch (err) {
    console.error(`[Redis] getCacheTTL("${key}") error:`, err);
    return -2;
  }
}
