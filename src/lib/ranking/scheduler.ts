import { getPublicSiteConfig } from "@/lib/site-config";
import { acquireLock } from "./cache";
import {
  computeCombinedRanking,
  computeFavPeriodRanking,
  computeFavTotalRanking,
  computeScoreRanking,
  computeSurgeRanking,
  computeTagHotRanking,
  computeTagSurgeRanking,
  persistRanking,
} from "./compute";
import type { RankingPeriod } from "./types";

interface TaskHandle {
  timer: ReturnType<typeof setInterval>;
  warmup: ReturnType<typeof setTimeout>;
}

const tasks: TaskHandle[] = [];

const ts = () => new Date().toISOString();

async function runWithLock(name: string, lockTtlSec: number, fn: () => Promise<void>): Promise<void> {
  const ok = await acquireLock(name, lockTtlSec);
  if (!ok) return;
  const t0 = Date.now();
  try {
    await fn();
    console.log(`[${ts()}][ranking] task "${name}" finished in ${Date.now() - t0}ms`);
  } catch (err) {
    console.error(`[${ts()}][ranking] task "${name}" failed`, err);
  }
}

function schedule(name: string, intervalMs: number, fn: () => Promise<void>): void {
  const lockTtlSec = Math.max(60, Math.floor((intervalMs / 1000) * 0.8));
  const tick = () => {
    void runWithLock(name, lockTtlSec, fn);
  };
  const warmup = setTimeout(tick, 30 * 1000);
  const timer = setInterval(tick, intervalMs);
  tasks.push({ timer, warmup });
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

let started = false;

/**
 * 注册某个 base 内容类型（video/image/game）的所有榜单。
 *
 * - 综合分 1d/7d/30d 三个粒度
 * - 飙升榜 1d
 * - 收藏周期榜 7d/30d（1d 周期过短，与日榜价值重合）
 * - 收藏累计榜 all
 */
function registerBaseContentTasks(type: "video" | "image" | "game"): void {
  // score 1d / 7d / 30d
  const scoreIntervals: Array<{ period: RankingPeriod; interval: number }> = [
    { period: "1d", interval: 10 * MINUTE },
    { period: "7d", interval: 1 * HOUR },
    { period: "30d", interval: 2 * HOUR },
  ];
  for (const { period, interval } of scoreIntervals) {
    schedule(`${type}:score:${period}`, interval, async () => {
      const items = await computeScoreRanking(type, period);
      await persistRanking(type, "score", period, items);
    });
  }

  // surge
  schedule(`${type}:surge:1d`, 30 * MINUTE, async () => {
    const items = await computeSurgeRanking(type);
    await persistRanking(type, "surge", "1d", items);
  });

  // fav_period 7d / 30d
  for (const period of ["7d", "30d"] as const) {
    schedule(`${type}:fav_period:${period}`, period === "7d" ? 1 * HOUR : 2 * HOUR, async () => {
      const items = await computeFavPeriodRanking(type, period);
      await persistRanking(type, "fav_period", period, items);
    });
  }

  // fav_total
  schedule(`${type}:fav_total:all`, 1 * HOUR, async () => {
    const items = await computeFavTotalRanking(type);
    await persistRanking(type, "fav_total", "all", items);
  });
}

/** 启动榜单调度器。多次调用幂等。 */
export async function startRankingScheduler(): Promise<void> {
  if (started) return;
  const config = await getPublicSiteConfig();
  if (!config.rankingEnabled) {
    console.log(`[${ts()}][ranking] disabled via site config, skip scheduler`);
    return;
  }
  started = true;

  // 三类基础内容
  registerBaseContentTasks("video");
  registerBaseContentTasks("image");
  registerBaseContentTasks("game");

  // 综合榜（依赖各基础榜，间隔略大于基础榜中最快的）
  for (const period of ["1d", "7d", "30d"] as const) {
    const interval = period === "1d" ? 15 * MINUTE : period === "7d" ? 1 * HOUR : 2 * HOUR;
    schedule(`combined:score:${period}`, interval, async () => {
      const items = await computeCombinedRanking(period);
      await persistRanking("combined", "score", period, items);
    });
  }

  // 标签榜
  schedule("tag:tag_hot:all", 1 * HOUR, async () => {
    const items = await computeTagHotRanking();
    await persistRanking("tag", "tag_hot", "all", items);
  });
  schedule("tag:tag_surge:1d", 1 * HOUR, async () => {
    const items = await computeTagSurgeRanking();
    await persistRanking("tag", "tag_surge", "1d", items);
  });

  console.log(`[${ts()}][ranking] scheduler started (${tasks.length} tasks)`);
}

export function stopRankingScheduler(): void {
  for (const { timer, warmup } of tasks) {
    clearInterval(timer);
    clearTimeout(warmup);
  }
  tasks.length = 0;
  started = false;
}

export async function restartRankingScheduler(): Promise<void> {
  stopRankingScheduler();
  await startRankingScheduler();
}
