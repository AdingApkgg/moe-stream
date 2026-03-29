import Redis from "ioredis";
import { env } from "@/env";

const IS_BUILD = process.env.NEXT_BUILD === "1";
const REDIS_URL = env.REDIS_URL || process.env.REDIS_URL;
export const REDIS_AVAILABLE = !!REDIS_URL && !IS_BUILD;

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisErrorLogged: boolean | undefined;
};

const MAX_RECONNECT_ATTEMPTS = process.env.NODE_ENV === "production" ? Infinity : 5;

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

function createRedis(): Redis {
  if (!REDIS_AVAILABLE) {
    if (!IS_BUILD) {
      console.warn("[Redis] REDIS_URL 未配置，需要 Redis 的功能（队列、Socket.io、限流等）将不可用。");
    }
    return new Redis({ lazyConnect: true, enableOfflineQueue: false });
  }
  return new Redis({
    ...parseRedisUrl(REDIS_URL!),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[Redis] 已达最大重连次数 (${MAX_RECONNECT_ATTEMPTS})，停止重连。`);
        return null;
      }
      return Math.min(times * 500, 10000);
    },
  });
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

if (REDIS_AVAILABLE) {
  redis.on("error", () => {
    if (!globalForRedis.redisErrorLogged) {
      globalForRedis.redisErrorLogged = true;
      console.warn("[Redis] 连接失败。如需 Redis 请确保服务已启动。");
    }
  });
  redis.on("connect", () => {
    globalForRedis.redisErrorLogged = false;
    console.log("[Redis] Connected");
  });
}

export default redis;

// ============================================================
// Redis 安全操作 wrapper（Redis 故障时静默降级，不影响主流程）
// ============================================================

const redisWarnLogged = new Set<string>();
function redisWarn(label: string, err: unknown) {
  if (redisWarnLogged.has(label)) return;
  redisWarnLogged.add(label);
  console.warn(`[Redis] ${label} — 操作失败`, (err as Error)?.message ?? "");
}

/**
 * 安全执行 Redis SET … NX … EX（用于去重/限流）。
 * Redis 不可用时返回 null（等同于「未去重」，允许操作继续）。
 */
export async function redisSetNX(key: string, value: string, ttlSeconds: number): Promise<string | null> {
  if (!REDIS_AVAILABLE) return "OK";
  try {
    return await redis.set(key, value, "EX", ttlSeconds, "NX");
  } catch (err) {
    redisWarn(`setNX("${key}")`, err);
    return "OK";
  }
}

/**
 * 安全检查 Redis 键是否存在（用于限流冷却检查）。
 * Redis 不可用时返回 false（允许操作继续）。
 */
export async function redisExists(key: string): Promise<boolean> {
  if (!REDIS_AVAILABLE) return false;
  try {
    return (await redis.exists(key)) === 1;
  } catch (err) {
    redisWarn(`exists("${key}")`, err);
    return false;
  }
}

/**
 * 安全执行 Redis SET … EX（用于设置限流冷却）。
 */
export async function redisSetEx(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!REDIS_AVAILABLE) return;
  try {
    await redis.set(key, value, "EX", ttlSeconds);
  } catch (err) {
    redisWarn(`setEx("${key}")`, err);
  }
}

/**
 * 安全执行 Redis INCR + EXPIRE（用于计数限流）。
 * Redis 不可用时返回 0（不限流）。
 */
export async function redisIncr(key: string, ttlSeconds: number): Promise<number> {
  if (!REDIS_AVAILABLE) return 0;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  } catch (err) {
    redisWarn(`incr("${key}")`, err);
    return 0;
  }
}
