import { z } from "zod";
import { router, adminProcedure, requireScope } from "../../trpc";
import { reloadPublicSiteConfig } from "@/lib/site-config";

const contentTypeSchema = z.enum(["video", "image", "game", "combined", "tag"]);
const categorySchema = z.enum(["score", "surge", "fav_period", "fav_total", "tag_hot", "tag_surge"]);
const periodSchema = z.enum(["1d", "7d", "30d", "all"]);

const weightsSchema = z.object({
  views: z.number().min(0).max(100),
  likes: z.number().min(0).max(100),
  favorites: z.number().min(0).max(100),
  comments: z.number().min(0).max(100),
});

const combinedQuotaSchema = z.object({
  video: z.number().min(0).max(1000),
  image: z.number().min(0).max(1000),
  game: z.number().min(0).max(1000),
});

export const adminRankingRouter = router({
  /** 读取当前榜单配置 */
  getConfig: adminProcedure.use(requireScope("settings:manage")).query(async ({ ctx }) => {
    const row = await ctx.prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: {
        rankingEnabled: true,
        rankingTopN: true,
        rankingWeights: true,
        rankingCombinedQuota: true,
      },
    });
    return {
      enabled: row?.rankingEnabled ?? true,
      topN: row?.rankingTopN ?? 100,
      weights: row?.rankingWeights ?? null,
      combinedQuota: row?.rankingCombinedQuota ?? null,
    };
  }),

  /** 更新榜单配置；更新后会重载 site-config 并重启调度器 */
  updateConfig: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        enabled: z.boolean().optional(),
        topN: z.number().min(10).max(1000).optional(),
        weights: weightsSchema.nullable().optional(),
        combinedQuota: combinedQuotaSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {};
      if (input.enabled !== undefined) data.rankingEnabled = input.enabled;
      if (input.topN !== undefined) data.rankingTopN = input.topN;
      if (input.weights !== undefined) data.rankingWeights = input.weights;
      if (input.combinedQuota !== undefined) data.rankingCombinedQuota = input.combinedQuota;

      await ctx.prisma.siteConfig.update({
        where: { id: "default" },
        data,
      });
      await reloadPublicSiteConfig();

      // 热重启调度器（dev 环境不可用时静默吞错）
      try {
        const { restartRankingScheduler } = await import("@/lib/ranking/scheduler");
        await restartRankingScheduler();
      } catch {}

      return { ok: true };
    }),

  /** 历史快照，用于画榜首变化趋势图 */
  getSnapshots: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        contentType: contentTypeSchema,
        category: categorySchema,
        period: periodSchema,
        days: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const snapshots = await ctx.prisma.rankingSnapshot.findMany({
        where: {
          contentType: input.contentType,
          category: input.category,
          period: input.period,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, items: true, createdAt: true },
      });
      return snapshots;
    }),

  /** 手动触发某个榜单立即重算（绕过 cron 周期） */
  refresh: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        contentType: contentTypeSchema,
        category: categorySchema,
        period: periodSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const {
        computeScoreRanking,
        computeSurgeRanking,
        computeFavPeriodRanking,
        computeFavTotalRanking,
        computeCombinedRanking,
        computeTagHotRanking,
        computeTagSurgeRanking,
        persistRanking,
      } = await import("@/lib/ranking/compute");

      const { contentType, category, period } = input;

      // 分发计算函数
      let items: Array<{ id: string; score: number }> = [];
      if (contentType === "tag") {
        if (category === "tag_hot") items = await computeTagHotRanking();
        else if (category === "tag_surge") items = await computeTagSurgeRanking();
        else throw new Error("标签类型仅支持 tag_hot / tag_surge");
      } else if (contentType === "combined") {
        if (category !== "score") throw new Error("综合榜仅支持 score 类别");
        items = await computeCombinedRanking(period);
      } else {
        // video / image / game
        if (category === "score") items = await computeScoreRanking(contentType, period);
        else if (category === "surge") items = await computeSurgeRanking(contentType);
        else if (category === "fav_period") items = await computeFavPeriodRanking(contentType, period);
        else if (category === "fav_total") items = await computeFavTotalRanking(contentType);
        else throw new Error(`不支持的组合: ${contentType}/${category}`);
      }

      await persistRanking(contentType, category, period, items);
      return { count: items.length };
    }),
});
