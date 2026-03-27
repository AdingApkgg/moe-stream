import { redis } from "@/lib/redis";
import { COVER_CONFIG } from "@/lib/cover-config";

type ProcessOptions = {
  concurrency?: number;
  maxItems?: number;
  pollTimeoutSeconds?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

function log(msg: string, ...args: unknown[]) {
  const ts = new Date().toISOString();
  const full = `[${ts}][CoverQueue] ${msg}${args.length ? " " + args.map(String).join(" ") : ""}`;
  console.log(full);
  appendCoverLog(full);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========== 日志存储 ==========

const LOG_KEY = "cover:logs";
const LOG_MAX_ENTRIES = 200;

function appendCoverLog(line: string): void {
  redis
    .lpush(LOG_KEY, line)
    .then(() => {
      redis.ltrim(LOG_KEY, 0, LOG_MAX_ENTRIES - 1).catch(() => {});
    })
    .catch(() => {});
}

/**
 * 向封面日志追加一条记录（供外部模块调用）
 */
export function pushCoverLog(tag: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  const full = `[${ts}][${tag}] ${msg}${args.length ? " " + args.map(String).join(" ") : ""}`;
  console.log(full);
  appendCoverLog(full);
}

export async function getCoverLogs(limit = 100): Promise<string[]> {
  return redis.lrange(LOG_KEY, 0, limit - 1);
}

export async function clearCoverLogs(): Promise<void> {
  await redis.del(LOG_KEY);
}

function lockKey(videoId: string) {
  return `cover:lock:${videoId}`;
}

function retryKey(videoId: string) {
  return `cover:retry:${videoId}`;
}

export async function acquireCoverLock(videoId: string): Promise<boolean> {
  const result = await redis.set(lockKey(videoId), "1", "EX", COVER_CONFIG.lockTtlSeconds, "NX");
  return result === "OK";
}

export async function refreshCoverLock(videoId: string): Promise<void> {
  await redis.expire(lockKey(videoId), COVER_CONFIG.lockTtlSeconds);
}

export async function releaseCoverLock(videoId: string): Promise<void> {
  await redis.del(lockKey(videoId));
}

export async function isCoverLocked(videoId: string): Promise<boolean> {
  const exists = await redis.exists(lockKey(videoId));
  return exists === 1;
}

/**
 * 将视频加入封面生成队列
 * 使用 try-finally 保证 push 失败时释放 lock
 */
export async function addToQueue(videoId: string): Promise<boolean> {
  const locked = await acquireCoverLock(videoId);
  if (!locked) return false;

  try {
    await redis.lpush(COVER_CONFIG.queueName, videoId);
    log(`入队: ${videoId}`);
    return true;
  } catch (err) {
    // push 失败，释放 lock 防止死锁
    await releaseCoverLock(videoId);
    log(`入队失败: ${videoId}, ${String(err)}`);
    return false;
  }
}

/**
 * 批量入队（pipeline 减少网络往返）
 * 返回成功入队的 videoId 数量
 */
export async function addToQueueBatch(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) return 0;

  // 批量尝试获取锁（pipeline）
  const pipeline = redis.pipeline();
  for (const id of videoIds) {
    pipeline.set(lockKey(id), "1", "EX", COVER_CONFIG.lockTtlSeconds, "NX");
  }
  const lockResults = await pipeline.exec();

  // 收集获取到锁的 videoId
  const lockedIds: string[] = [];
  if (lockResults) {
    for (let i = 0; i < lockResults.length; i++) {
      const [err, result] = lockResults[i];
      if (!err && result === "OK") {
        lockedIds.push(videoIds[i]);
      }
    }
  }

  if (lockedIds.length === 0) return 0;

  // 批量入队（pipeline）
  try {
    const pushPipeline = redis.pipeline();
    for (const id of lockedIds) {
      pushPipeline.lpush(COVER_CONFIG.queueName, id);
    }
    await pushPipeline.exec();
    log(`批量入队: ${lockedIds.length} 个视频`);
    return lockedIds.length;
  } catch (err) {
    // push 失败，释放所有锁
    const releasePipeline = redis.pipeline();
    for (const id of lockedIds) {
      releasePipeline.del(lockKey(id));
    }
    await releasePipeline.exec();
    log(`批量入队失败: ${String(err)}`);
    return 0;
  }
}

async function incrementRetry(videoId: string): Promise<number> {
  // pipeline 合并 INCR + EXPIRE 为一次往返
  const pipeline = redis.pipeline();
  pipeline.incr(retryKey(videoId));
  pipeline.expire(retryKey(videoId), 3600);
  const results = await pipeline.exec();
  return (results?.[0]?.[1] as number) ?? 0;
}

/**
 * 清除重试计数 + 释放锁（pipeline 合并）
 */
async function cleanupAfterDone(videoId: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(retryKey(videoId));
  pipeline.del(lockKey(videoId));
  await pipeline.exec();
}

// ========== 统计计数 ==========

const STATS_KEY = "cover:stats";

async function recordStats(ok: boolean, elapsedMs: number): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(STATS_KEY, ok ? "success" : "failure", 1);
    pipeline.hincrby(STATS_KEY, "total_ms", elapsedMs);
    pipeline.hincrby(STATS_KEY, "count", 1);
    await pipeline.exec();
  } catch {
    // 统计失败不影响主流程
  }
}

export interface CoverStats {
  success: number;
  failure: number;
  totalMs: number;
  count: number;
  avgMs: number;
  queueLength: number;
}

export async function getCoverStats(): Promise<CoverStats> {
  const pipeline = redis.pipeline();
  pipeline.hgetall(STATS_KEY);
  pipeline.llen(COVER_CONFIG.queueName);
  const results = await pipeline.exec();

  const raw = (results?.[0]?.[1] as Record<string, string>) || {};
  const queueLength = (results?.[1]?.[1] as number) || 0;

  const success = parseInt(raw.success || "0", 10);
  const failure = parseInt(raw.failure || "0", 10);
  const totalMs = parseInt(raw.total_ms || "0", 10);
  const count = parseInt(raw.count || "0", 10);

  return {
    success,
    failure,
    totalMs,
    count,
    avgMs: count > 0 ? Math.round(totalMs / count) : 0,
    queueLength,
  };
}

export async function resetCoverStats(): Promise<void> {
  await redis.del(STATS_KEY);
}

// ========== 永久失败追踪 ==========

const FAILED_SET_KEY = "cover:failed";
const FAIL_COUNT_PREFIX = "cover:failcount:";
const MAX_TOTAL_FAILURES = 5;

/**
 * 记录视频的总失败次数（跨 backfill 周期累计）
 * 当总失败次数超过阈值时，加入永久失败集合
 */
export async function recordFailure(videoId: string): Promise<boolean> {
  const countKey = `${FAIL_COUNT_PREFIX}${videoId}`;
  const pipeline = redis.pipeline();
  pipeline.incr(countKey);
  pipeline.expire(countKey, 86400 * 7); // 7 天后自动清除计数
  const results = await pipeline.exec();
  const count = (results?.[0]?.[1] as number) ?? 0;

  if (count >= MAX_TOTAL_FAILURES) {
    await redis.sadd(FAILED_SET_KEY, videoId);
    await redis.del(countKey);
    log(`视频 ${videoId} 已失败 ${count} 次，标记为永久失败`);
    return true;
  }
  return false;
}

export async function isPermFailedVideo(videoId: string): Promise<boolean> {
  return (await redis.sismember(FAILED_SET_KEY, videoId)) === 1;
}

export async function getPermFailedVideos(): Promise<string[]> {
  return redis.smembers(FAILED_SET_KEY);
}

export async function clearPermFailed(videoIds?: string[]): Promise<number> {
  if (!videoIds || videoIds.length === 0) {
    const count = await redis.scard(FAILED_SET_KEY);
    await redis.del(FAILED_SET_KEY);
    return count;
  }
  return redis.srem(FAILED_SET_KEY, ...videoIds);
}

export async function processQueue(
  processor: (videoId: string) => Promise<boolean>,
  options: ProcessOptions = {},
): Promise<{ processed: number; errors: number }> {
  const concurrency = options.concurrency ?? COVER_CONFIG.maxConcurrency;
  const pollTimeoutSeconds = options.pollTimeoutSeconds ?? 5;
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const maxRetries = options.maxRetries ?? COVER_CONFIG.maxRetries;
  const retryDelayMs = options.retryDelayMs ?? COVER_CONFIG.retryDelay;

  let processed = 0;
  let errors = 0;
  let shouldStop = false;

  log(`启动 ${concurrency} 个 worker`);

  const worker = async (workerId: number) => {
    log(`Worker ${workerId} 启动`);
    let consecutiveErrors = 0;
    while (!shouldStop) {
      let result: [string, string] | null;
      try {
        result = await redis.brpop(COVER_CONFIG.queueName, pollTimeoutSeconds);
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors === 1) {
          log(`Worker ${workerId} Redis 不可用，等待重连...`);
        }
        // 退避等待，避免刷屏
        await sleep(Math.min(consecutiveErrors * 2000, 30000));
        continue;
      }
      consecutiveErrors = 0;
      if (!result) continue;

      const videoId = result[1];
      const startTime = Date.now();
      log(`Worker ${workerId} 取到任务: ${videoId}`);
      await refreshCoverLock(videoId);

      let ok = false;
      try {
        ok = await processor(videoId);
      } catch (e) {
        log(`Worker ${workerId} 处理异常: ${videoId}`, e);
        ok = false;
      }

      const elapsed = Date.now() - startTime;
      processed += 1;

      await recordStats(ok, elapsed);

      if (ok) {
        await cleanupAfterDone(videoId);
        log(`Worker ${workerId} 完成: ${videoId} (${elapsed}ms)`);
      } else {
        errors += 1;
        const retryCount = await incrementRetry(videoId);
        if (retryCount <= maxRetries) {
          log(`Worker ${workerId} 重试 ${retryCount}/${maxRetries}: ${videoId}`);
          await sleep(retryDelayMs);
          await redis.lpush(COVER_CONFIG.queueName, videoId);
        } else {
          log(`Worker ${workerId} 放弃: ${videoId} (已重试 ${maxRetries} 次)`);
          await cleanupAfterDone(videoId);
          await recordFailure(videoId);
        }
      }

      if (processed >= maxItems) {
        shouldStop = true;
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  return { processed, errors };
}
