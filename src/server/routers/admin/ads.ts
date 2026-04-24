import { z } from "zod";
import { router, adminProcedure, requireScope } from "../../trpc";

/**
 * 管理端广告指标查询。
 * 数据来源：AdMetric 表（按天聚合，adId+date 主键）。
 */
export const adminAdsRouter = router({
  /**
   * 获取所有广告在最近 N 天的聚合指标。
   * 返回 Record<adId, { impressions, clicks }>，前端直接按 adId 查询。
   */
  getAllMetrics: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).default(30),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await ctx.prisma.adMetric.groupBy({
        by: ["adId"],
        where: { date: { gte: since } },
        _sum: { impressions: true, clicks: true },
      });

      const map: Record<string, { impressions: number; clicks: number }> = {};
      for (const row of rows) {
        map[row.adId] = {
          impressions: row._sum.impressions ?? 0,
          clicks: row._sum.clicks ?? 0,
        };
      }
      return { days, metrics: map };
    }),

  /**
   * 获取单个广告的每日指标（用于趋势图，暂时预留接口）。
   */
  getMetricsByAd: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        adId: z.string().min(1).max(80),
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await ctx.prisma.adMetric.findMany({
        where: { adId: input.adId, date: { gte: since } },
        orderBy: { date: "asc" },
        select: { date: true, impressions: true, clicks: true },
      });
      return rows;
    }),
});
