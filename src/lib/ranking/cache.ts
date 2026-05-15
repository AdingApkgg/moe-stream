import { redis, REDIS_AVAILABLE } from "@/lib/redis";
import type { RankingCategory, RankingContentType, RankingItem, RankingPeriod } from "./types";

/** 缓存 TTL：略大于最长刷新间隔，防止 cron 失败时短暂空窗 */
const CACHE_TTL_SECONDS = 6 * 60 * 60;

/** 生成 Redis ZSet key */
export function rankingKey(type: RankingContentType, category: RankingCategory, period: RankingPeriod): string {
  return `rank:${type}:${category}:${period}`;
}

/** 写入 ZSet（先清空后批量 ZADD，避免历史项残留） */
export async function setRanking(
  type: RankingContentType,
  category: RankingCategory,
  period: RankingPeriod,
  items: RankingItem[],
): Promise<void> {
  if (!REDIS_AVAILABLE) return;
  const key = rankingKey(type, category, period);
  try {
    const pipe = redis.pipeline();
    pipe.del(key);
    if (items.length > 0) {
      const args: (string | number)[] = [];
      for (const item of items) {
        args.push(item.score, item.id);
      }
      pipe.zadd(key, ...args);
      pipe.expire(key, CACHE_TTL_SECONDS);
    }
    await pipe.exec();
  } catch (err) {
    console.error(`[ranking] setRanking("${key}") failed`, err);
  }
}

/** 读取 ZSet 排名（按分数倒序）。返回 [{ id, score, rank }, ...] */
export async function getRanking(
  type: RankingContentType,
  category: RankingCategory,
  period: RankingPeriod,
  limit: number,
  offset: number,
): Promise<Array<{ id: string; score: number; rank: number }>> {
  if (!REDIS_AVAILABLE) return [];
  const key = rankingKey(type, category, period);
  try {
    const stop = offset + limit - 1;
    const raw = await redis.zrevrange(key, offset, stop, "WITHSCORES");
    const result: Array<{ id: string; score: number; rank: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({
        id: raw[i],
        score: Number(raw[i + 1]),
        rank: offset + i / 2 + 1,
      });
    }
    return result;
  } catch (err) {
    console.error(`[ranking] getRanking("${key}") failed`, err);
    return [];
  }
}

/** 抢占分布式锁，TTL 内只有一个进程能执行。返回是否抢到 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  if (!REDIS_AVAILABLE) return true;
  try {
    const result = await redis.set(`rank:lock:${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (err) {
    console.error(`[ranking] acquireLock("${key}") failed`, err);
    return false;
  }
}
