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
  console.log(`[${ts}][CoverQueue] ${msg}`, ...args);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockKey(videoId: string) {
  return `cover:lock:${videoId}`;
}

function retryKey(videoId: string) {
  return `cover:retry:${videoId}`;
}

export async function acquireCoverLock(videoId: string): Promise<boolean> {
  const result = await redis.set(
    lockKey(videoId),
    "1",
    "EX",
    COVER_CONFIG.lockTtlSeconds,
    "NX"
  );
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

async function incrementRetry(videoId: string): Promise<number> {
  const count = await redis.incr(retryKey(videoId));
  await redis.expire(retryKey(videoId), 3600);
  return count;
}

async function resetRetry(videoId: string): Promise<void> {
  await redis.del(retryKey(videoId));
}

export async function processQueue(
  processor: (videoId: string) => Promise<boolean>,
  options: ProcessOptions = {}
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
    while (!shouldStop) {
      const result = await redis.brpop(COVER_CONFIG.queueName, pollTimeoutSeconds);
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

      if (ok) {
        await resetRetry(videoId);
        await releaseCoverLock(videoId);
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
          await resetRetry(videoId);
          await releaseCoverLock(videoId);
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
