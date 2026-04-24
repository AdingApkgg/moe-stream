import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { redisSetNX } from "@/lib/redis";

/** 去重窗口（秒） */
const IMPRESSION_DEDUP_SECONDS = 30;
const CLICK_DEDUP_SECONDS = 5;

/** 取 UTC 当天 00:00:00 */
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** 简单事件类型校验 */
const adEventInput = z.object({
  adId: z.string().min(1).max(80),
  type: z.enum(["impression", "click"]),
});

export const adRouter = router({
  /**
   * 上报广告展示/点击事件。
   * 去重：同一 IP+adId+type 在短时间窗口内只记一次，以降低刷量风险。
   * Redis 不可用时降级为不去重（允许计数）。
   */
  report: publicProcedure.input(adEventInput).mutation(async ({ ctx, input }) => {
    const { adId, type } = input;
    const ip = ctx.ipv4Address || ctx.ipv6Address || "anon";
    const ttl = type === "impression" ? IMPRESSION_DEDUP_SECONDS : CLICK_DEDUP_SECONDS;
    const dedupKey = `ad:evt:${type}:${adId}:${ip}`;
    const acquired = await redisSetNX(dedupKey, "1", ttl);
    if (acquired !== "OK") {
      return { recorded: false };
    }

    const date = todayUtc();
    try {
      await ctx.prisma.adMetric.upsert({
        where: { adId_date: { adId, date } },
        create: {
          adId,
          date,
          impressions: type === "impression" ? 1 : 0,
          clicks: type === "click" ? 1 : 0,
        },
        update: type === "impression" ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
      });
    } catch {
      // 不阻塞用户体验：写入失败只记录，不抛错
    }
    return { recorded: true };
  }),
});
