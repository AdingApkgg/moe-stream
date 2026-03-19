import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { awardDailyLogin, awardCheckin } from "@/lib/points";

async function generateUniqueCode(
  prisma: typeof import("@/lib/prisma").prisma
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = nanoid(8);
    const existing = await prisma.referralLink.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "无法生成唯一推广码" });
}

function getDateOnly(d: Date = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const referralRouter = router({
  // ========== 用户端 ==========

  getMyStats: protectedProcedure
    .input(z.object({ linkIds: z.array(z.string()).optional() }).optional())
    .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const linkIds = input?.linkIds?.length ? input.linkIds : undefined;
    const today = getDateOnly();
    const yesterdayStart = getDateOnly();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const linkWhere = linkIds ? { userId, id: { in: linkIds } } : { userId };
    const dailyStatWhere = linkIds
      ? { userId, referralLinkId: { in: linkIds } }
      : { userId };
    const referralRecordWhere = linkIds
      ? { referrerId: userId, referralLinkId: { in: linkIds } }
      : { referrerId: userId };

    const [user, linkAgg, todayDailyStat, yesterdayDailyStat, referralPoints] = await Promise.all([
      ctx.prisma.user.findUnique({
        where: { id: userId },
        select: {
          points: true,
          referralCode: true,
          _count: { select: { referralsMade: true, referralLinks: true } },
        },
      }),
      ctx.prisma.referralLink.aggregate({
        where: linkWhere,
        _sum: { clicks: true, uniqueClicks: true, registers: true },
        _count: true,
      }),
      ctx.prisma.referralDailyStat.aggregate({
        where: { ...dailyStatWhere, date: today },
        _sum: { clicks: true, uniqueClicks: true, registers: true },
      }),
      ctx.prisma.referralDailyStat.aggregate({
        where: { ...dailyStatWhere, date: yesterdayStart },
        _sum: { clicks: true, uniqueClicks: true, registers: true },
      }),
      ctx.prisma.referralRecord.aggregate({
        where: referralRecordWhere,
        _sum: { pointsAwarded: true },
      }),
    ]);

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    const totalClicks = linkAgg._sum.clicks || 0;
    const totalUniqueClicks = linkAgg._sum.uniqueClicks || 0;
    const totalRegisters = linkAgg._sum.registers || 0;
    const todayClicks = todayDailyStat._sum.clicks || 0;
    const todayUniqueClicks = todayDailyStat._sum.uniqueClicks || 0;
    const todayRegisters = todayDailyStat._sum.registers || 0;
    const yesterdayUniqueClicks = yesterdayDailyStat._sum.uniqueClicks || 0;
    const yesterdayRegisters = yesterdayDailyStat._sum.registers || 0;

    return {
      points: user.points,
      referralCode: user.referralCode,
      totalReferrals: linkIds
        ? await ctx.prisma.referralRecord.count({ where: referralRecordWhere })
        : user._count.referralsMade,
      totalLinks: linkAgg._count,
      todayClicks,
      todayUniqueClicks,
      todayRegisters,
      yesterdayUniqueClicks,
      yesterdayRegisters,
      totalClicks,
      totalUniqueClicks,
      totalRegisters,
      conversionRate: totalUniqueClicks > 0 ? Math.round((totalRegisters / totalUniqueClicks) * 10000) / 100 : 0,
      earnedPoints: referralPoints._sum.pointsAwarded || 0,
    };
  }),

  getMyTrendStats: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30), linkIds: z.array(z.string()).optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { days, linkIds } = input;

      const startDate = getDateOnly();
      startDate.setDate(startDate.getDate() - days + 1);

      const where: Record<string, unknown> = { userId, date: { gte: startDate } };
      if (linkIds?.length) where.referralLinkId = { in: linkIds };

      const stats = await ctx.prisma.referralDailyStat.findMany({
        where,
        select: { date: true, clicks: true, uniqueClicks: true, registers: true },
        orderBy: { date: "asc" },
      });

      const dateMap = new Map<string, { clicks: number; uniqueClicks: number; registers: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dateMap.set(dateKey(d), { clicks: 0, uniqueClicks: 0, registers: 0 });
      }

      for (const s of stats) {
        const key = dateKey(s.date);
        const entry = dateMap.get(key);
        if (entry) {
          entry.clicks += s.clicks;
          entry.uniqueClicks += s.uniqueClicks;
          entry.registers += s.registers;
        }
      }

      return Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));
    }),

  getChannelStats: protectedProcedure
    .input(z.object({ linkIds: z.array(z.string()).optional() }).optional())
    .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const linkIds = input?.linkIds?.length ? input.linkIds : undefined;

    const linkWhere = linkIds ? { userId, id: { in: linkIds } } : { userId };

    const links = await ctx.prisma.referralLink.findMany({
      where: linkWhere,
      select: { channel: true, clicks: true, uniqueClicks: true, registers: true },
    });

    const channelMap = new Map<string, { clicks: number; uniqueClicks: number; registers: number; linkCount: number }>();
    for (const link of links) {
      const ch = link.channel || "direct";
      const entry = channelMap.get(ch) || { clicks: 0, uniqueClicks: 0, registers: 0, linkCount: 0 };
      entry.clicks += link.clicks;
      entry.uniqueClicks += link.uniqueClicks;
      entry.registers += link.registers;
      entry.linkCount++;
      channelMap.set(ch, entry);
    }

    return Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        channel,
        ...data,
        conversionRate: data.uniqueClicks > 0
          ? Math.round((data.registers / data.uniqueClicks) * 10000) / 100
          : 0,
      }))
      .sort((a, b) => b.registers - a.registers);
  }),

  getTopLinks: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5), sortBy: z.enum(["uniqueClicks", "registers", "conversionRate"]).default("registers"), linkIds: z.array(z.string()).optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, sortBy, linkIds } = input;

      const linkWhere = linkIds?.length ? { userId, id: { in: linkIds } } : { userId };

      const links = await ctx.prisma.referralLink.findMany({
        where: linkWhere,
        select: { id: true, code: true, label: true, channel: true, clicks: true, uniqueClicks: true, registers: true, createdAt: true },
      });

      const ranked = links.map((l) => ({
        ...l,
        conversionRate: l.uniqueClicks > 0 ? Math.round((l.registers / l.uniqueClicks) * 10000) / 100 : 0,
      }));

      ranked.sort((a, b) => {
        if (sortBy === "conversionRate") return b.conversionRate - a.conversionRate;
        return (b[sortBy] as number) - (a[sortBy] as number);
      });

      return ranked.slice(0, limit);
    }),

  ensureReferralCode: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (user?.referralCode) return { code: user.referralCode };

    const code = nanoid(8);
    const updated = await ctx.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
      select: { referralCode: true },
    });

    return { code: updated.referralCode! };
  }),

  getMyLinks: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        channel: z.string().optional(),
        isActive: z.boolean().optional(),
        sortBy: z.enum(["createdAt", "clicks", "uniqueClicks", "registers"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, page, search, channel, isActive, sortBy, sortDir } = input;

      const where: Record<string, unknown> = { userId };
      if (search?.trim()) {
        where.OR = [
          { label: { contains: search.trim(), mode: "insensitive" } },
          { code: { contains: search.trim(), mode: "insensitive" } },
        ];
      }
      if (channel !== undefined && channel !== "") {
        where.channel = channel === "_none" ? null : channel;
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [links, totalCount] = await Promise.all([
        ctx.prisma.referralLink.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortDir },
        }),
        ctx.prisma.referralLink.count({ where }),
      ]);

      return {
        links,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  createLink: protectedProcedure
    .input(
      z.object({
        label: z.string().max(100).optional(),
        channel: z.string().max(50).optional(),
        targetUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const siteConfig = await ctx.prisma.siteConfig.findUnique({
        where: { id: "default" },
        select: { referralEnabled: true, referralMaxLinksPerUser: true },
      });

      if (!siteConfig?.referralEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "推广系统未启用" });
      }

      const currentCount = await ctx.prisma.referralLink.count({ where: { userId } });
      if (currentCount >= (siteConfig.referralMaxLinksPerUser || 20)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `推广链接数量已达上限（${siteConfig.referralMaxLinksPerUser}）`,
        });
      }

      const code = await generateUniqueCode(ctx.prisma);

      const link = await ctx.prisma.referralLink.create({
        data: {
          userId,
          code,
          label: input.label || null,
          channel: input.channel || null,
          targetUrl: input.targetUrl || null,
        },
      });

      return link;
    }),

  updateLink: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().max(100).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.prisma.referralLink.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });

      if (!link || link.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "推广链接不存在" });
      }

      const data: Record<string, unknown> = {};
      if (input.label !== undefined) data.label = input.label || null;
      if (input.isActive !== undefined) data.isActive = input.isActive;

      return ctx.prisma.referralLink.update({
        where: { id: input.id },
        data,
      });
    }),

  deleteLink: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.prisma.referralLink.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });

      if (!link || link.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "推广链接不存在" });
      }

      await ctx.prisma.referralLink.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getMyReferrals: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        linkId: z.string().optional(),
        channel: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, page, search, linkId, channel } = input;

      const where: Record<string, unknown> = { referrerId: userId };
      if (linkId) {
        where.referralLinkId = linkId;
      }
      if (channel !== undefined && channel !== "") {
        where.referralLink = { channel: channel === "_none" ? null : channel };
      }
      if (search?.trim()) {
        where.referredUser = {
          OR: [
            { username: { contains: search.trim(), mode: "insensitive" } },
            { nickname: { contains: search.trim(), mode: "insensitive" } },
          ],
        };
      }

      const [records, totalCount] = await Promise.all([
        ctx.prisma.referralRecord.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            referredUser: {
              select: { id: true, username: true, nickname: true, avatar: true, createdAt: true },
            },
            referralLink: {
              select: { code: true, label: true, channel: true },
            },
          },
        }),
        ctx.prisma.referralRecord.count({ where }),
      ]);

      return {
        records,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  getPointsHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        page: z.number().min(1).default(1),
        type: z.string().optional(),
        amountDir: z.enum(["income", "expense"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { limit, page, type, amountDir } = input;

      const where: Record<string, unknown> = { userId };
      if (type) {
        where.type = type;
      }
      if (amountDir === "income") {
        where.amount = { gt: 0 };
      } else if (amountDir === "expense") {
        where.amount = { lt: 0 };
      }

      const [transactions, totalCount] = await Promise.all([
        ctx.prisma.pointsTransaction.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.pointsTransaction.count({ where }),
      ]);

      return {
        transactions,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  claimDailyLogin: protectedProcedure.mutation(async ({ ctx }) => {
    const points = await awardDailyLogin(ctx.session.user.id);
    return { awarded: points > 0, points };
  }),

  checkin: protectedProcedure.mutation(async ({ ctx }) => {
    const points = await awardCheckin(ctx.session.user.id);
    return { awarded: points > 0, points };
  }),

  getCheckinStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [config, todayTx] = await Promise.all([
      ctx.prisma.siteConfig.findUnique({
        where: { id: "default" },
        select: { checkinEnabled: true, checkinPointsMin: true, checkinPointsMax: true },
      }),
      ctx.prisma.pointsTransaction.findFirst({
        where: { userId, type: "CHECKIN", createdAt: { gte: todayStart } },
        select: { amount: true },
      }),
    ]);

    return {
      enabled: config?.checkinEnabled ?? false,
      checkedInToday: !!todayTx,
      todayPoints: todayTx?.amount ?? 0,
      pointsMin: config?.checkinPointsMin ?? 1,
      pointsMax: config?.checkinPointsMax ?? 10,
    };
  }),

  // ========== 管理端 ==========

  adminGetOverview: adminProcedure.query(async ({ ctx }) => {
    const today = getDateOnly();
    const yesterdayStart = getDateOnly();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [
      totalReferrals, totalLinks, totalPointsAwarded,
      todayAgg, yesterdayAgg, totalClicksAgg,
    ] = await Promise.all([
      ctx.prisma.referralRecord.count(),
      ctx.prisma.referralLink.count(),
      ctx.prisma.referralRecord.aggregate({ _sum: { pointsAwarded: true } }),
      ctx.prisma.referralDailyStat.aggregate({
        where: { date: today },
        _sum: { clicks: true, uniqueClicks: true, registers: true },
      }),
      ctx.prisma.referralDailyStat.aggregate({
        where: { date: yesterdayStart },
        _sum: { clicks: true, uniqueClicks: true, registers: true },
      }),
      ctx.prisma.referralLink.aggregate({
        _sum: { clicks: true, uniqueClicks: true },
      }),
    ]);

    return {
      totalReferrals,
      totalLinks,
      totalPointsAwarded: totalPointsAwarded._sum.pointsAwarded || 0,
      totalClicks: totalClicksAgg._sum.clicks || 0,
      totalUniqueClicks: totalClicksAgg._sum.uniqueClicks || 0,
      todayClicks: todayAgg._sum.clicks || 0,
      todayUniqueClicks: todayAgg._sum.uniqueClicks || 0,
      todayRegisters: todayAgg._sum.registers || 0,
      yesterdayUniqueClicks: yesterdayAgg._sum.uniqueClicks || 0,
      yesterdayRegisters: yesterdayAgg._sum.registers || 0,
    };
  }),

  adminGetTrendStats: adminProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const { days } = input;
      const startDate = getDateOnly();
      startDate.setDate(startDate.getDate() - days + 1);

      const stats = await ctx.prisma.referralDailyStat.findMany({
        where: { date: { gte: startDate } },
        select: { date: true, clicks: true, uniqueClicks: true, registers: true },
      });

      const dateMap = new Map<string, { clicks: number; uniqueClicks: number; registers: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dateMap.set(dateKey(d), { clicks: 0, uniqueClicks: 0, registers: 0 });
      }

      for (const s of stats) {
        const key = dateKey(s.date);
        const entry = dateMap.get(key);
        if (entry) {
          entry.clicks += s.clicks;
          entry.uniqueClicks += s.uniqueClicks;
          entry.registers += s.registers;
        }
      }

      return Array.from(dateMap.entries()).map(([date, data]) => ({ date, ...data }));
    }),

  adminGetTopReferrers: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const top = await ctx.prisma.referralRecord.groupBy({
        by: ["referrerId"],
        _count: { id: true },
        _sum: { pointsAwarded: true },
        orderBy: { _count: { id: "desc" } },
        take: input.limit,
      });

      const userIds = top.map((t) => t.referrerId);
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, nickname: true, avatar: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return top.map((t) => ({
        user: userMap.get(t.referrerId) || { id: t.referrerId, username: "unknown", nickname: null, avatar: null },
        referralCount: t._count.id,
        totalPoints: t._sum.pointsAwarded || 0,
      }));
    }),

  adminAdjustPoints: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        amount: z.number().int(),
        description: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newBalance = await ctx.prisma.$transaction(async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { id: input.userId },
          select: { id: true, points: true },
        });

        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
        }

        if (targetUser.points + input.amount < 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "调整后积分不能为负数" });
        }

        const updated = await tx.user.update({
          where: { id: input.userId },
          data: { points: { increment: input.amount } },
          select: { points: true },
        });

        await tx.pointsTransaction.create({
          data: {
            userId: input.userId,
            amount: input.amount,
            balance: updated.points,
            type: "ADMIN_ADJUST",
            description: input.description || `管理员手动调整 ${input.amount > 0 ? "+" : ""}${input.amount}`,
          },
        });

        return updated.points;
      });

      return { success: true, newBalance };
    }),
});
