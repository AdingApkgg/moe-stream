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

  /**
   * 全站每日总曝光/点击趋势（用于面积+折线图）。
   */
  getDailyTrend: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ days: z.number().int().min(7).max(180).default(30) }))
    .query(async ({ ctx, input }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(start.getDate() - input.days + 1);

      const rows = await ctx.prisma.adMetric.groupBy({
        by: ["date"],
        where: { date: { gte: start } },
        _sum: { impressions: true, clicks: true },
      });

      const toKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const trend: Record<string, { impressions: number; clicks: number }> = {};
      for (let i = 0; i < input.days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        trend[toKey(d)] = { impressions: 0, clicks: 0 };
      }
      for (const r of rows) {
        const k = toKey(new Date(r.date));
        if (trend[k]) {
          trend[k].impressions += r._sum.impressions || 0;
          trend[k].clicks += r._sum.clicks || 0;
        }
      }
      return Object.entries(trend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          impressions: d.impressions,
          clicks: d.clicks,
          ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
        }));
    }),

  /**
   * 取近 N 天 Top N 广告（按指定指标排序）。
   * 返回 adId 与指标，由前端再用 sponsorAds 拼标题。
   */
  getTopAds: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
        by: z.enum(["impressions", "clicks", "ctr"]).default("impressions"),
        limit: z.number().int().min(3).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await ctx.prisma.adMetric.groupBy({
        by: ["adId"],
        where: { date: { gte: since } },
        _sum: { impressions: true, clicks: true },
      });

      const items = rows.map((r) => {
        const impressions = r._sum.impressions || 0;
        const clicks = r._sum.clicks || 0;
        return {
          adId: r.adId,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        };
      });

      items.sort((a, b) => b[input.by] - a[input.by]);
      return items.slice(0, input.limit);
    }),
});
