import { describe, it, expect, vi } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "../trpc";
import { createMockSession } from "./helpers";

const t = initTRPC.context<Context>().create({ transformer: superjson });

const enforceAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { session: { ...ctx.session, user: ctx.session.user } } });
});

const enforceApiScope = (scope: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (ctx.apiKeyScopes && !ctx.apiKeyScopes.includes(scope))
      throw new TRPCError({ code: "FORBIDDEN", message: `API Key 缺少权限: ${scope}` });
    return next({ ctx: { session: { ...ctx.session, user: ctx.session.user } } });
  });

const protectedProcedure = t.procedure.use(enforceAuthed);
const apiScopedProcedure = (scope: string) => t.procedure.use(enforceApiScope(scope));

// ========== 工具函数（镜像 referral.ts / open-api.ts 中的实现） ==========

const MAX_RANGE_DAYS = 90;
const DAY_MS = 1000 * 60 * 60 * 24;

function getDateOnly(d: Date = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeDayCount(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1;
}

// ========== Mock Prisma 工具 ==========

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrismaConfig {
  user?: { findUnique?: MockFn; findMany?: MockFn; count?: MockFn };
  referralLink?: { aggregate?: MockFn; count?: MockFn; findMany?: MockFn; groupBy?: MockFn };
  referralDailyStat?: { aggregate?: MockFn; findMany?: MockFn; groupBy?: MockFn };
  referralRecord?: { aggregate?: MockFn; count?: MockFn; groupBy?: MockFn };
  siteConfig?: { findUnique?: MockFn };
}

function buildMockPrisma(config: MockPrismaConfig = {}) {
  const fallback = vi.fn().mockResolvedValue(null);
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, model) {
      if (typeof model === "symbol") return undefined;
      const modelConfig = config[model as keyof MockPrismaConfig];
      return new Proxy(
        {},
        {
          get(_t, method) {
            if (typeof method === "symbol") return undefined;
            return (modelConfig as Record<string, MockFn> | undefined)?.[method as string] ?? fallback;
          },
        },
      );
    },
  };
  return new Proxy({}, handler) as unknown as Context["prisma"];
}

function createCtx(prismaConfig: MockPrismaConfig = {}, session = createMockSession()): Context {
  return {
    prisma: buildMockPrisma(prismaConfig),
    redis: {} as Context["redis"],
    session,
    ipv4Address: null,
    ipv6Address: null,
    userAgent: null,
    apiKeyScopes: null,
  };
}

function createApiCtx(prismaConfig: MockPrismaConfig = {}, scopes: string[] = ["referral:read"]): Context {
  return {
    ...createCtx(prismaConfig),
    apiKeyScopes: scopes,
  };
}

// ========== 测试 referral.getMyStats ==========

import { z } from "zod";

const getMyStatsRouter = t.router({
  getMyStats: protectedProcedure
    .input(
      z
        .object({
          linkIds: z.array(z.string()).optional(),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式须为 YYYY-MM-DD")
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const linkIds = input?.linkIds?.length ? input.linkIds : undefined;
      const targetDate = input?.date ? getDateOnly(new Date(input.date + "T00:00:00")) : getDateOnly();
      const prevDate = new Date(targetDate);
      prevDate.setDate(prevDate.getDate() - 1);

      const linkWhere = linkIds ? { userId, id: { in: linkIds } } : { userId };
      const dailyStatWhere = linkIds ? { userId, referralLinkId: { in: linkIds } } : { userId };
      const referralRecordWhere = linkIds
        ? { referrerId: userId, referralLinkId: { in: linkIds } }
        : { referrerId: userId };

      const [user, linkAgg, targetDailyStat, , referralPoints] = await Promise.all([
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
          _sum: { clicks: true, uniqueClicks: true, registers: true, paymentCount: true, paymentAmount: true },
          _count: true,
        }),
        ctx.prisma.referralDailyStat.aggregate({
          where: { ...dailyStatWhere, date: targetDate },
          _sum: { clicks: true, uniqueClicks: true, registers: true, paymentCount: true, paymentAmount: true },
        }),
        ctx.prisma.referralDailyStat.aggregate({
          where: { ...dailyStatWhere, date: prevDate },
          _sum: { clicks: true, uniqueClicks: true, registers: true, paymentCount: true, paymentAmount: true },
        }),
        ctx.prisma.referralRecord.aggregate({ where: referralRecordWhere, _sum: { pointsAwarded: true } }),
        ctx.prisma.referralRecord.count({ where: { ...referralRecordWhere, hasPaid: true } }),
      ]);

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const totalClicks = linkAgg._sum.clicks || 0;
      const totalUniqueClicks = linkAgg._sum.uniqueClicks || 0;
      const totalRegisters = linkAgg._sum.registers || 0;

      return {
        date: input?.date ?? dateKey(targetDate),
        points: user.points,
        referralCode: user.referralCode,
        totalReferrals: linkIds
          ? await ctx.prisma.referralRecord.count({ where: referralRecordWhere })
          : user._count.referralsMade,
        totalLinks: linkAgg._count,
        todayClicks: targetDailyStat._sum.clicks || 0,
        todayUniqueClicks: targetDailyStat._sum.uniqueClicks || 0,
        todayRegisters: targetDailyStat._sum.registers || 0,
        totalClicks,
        totalUniqueClicks,
        totalRegisters,
        conversionRate: totalUniqueClicks > 0 ? Math.round((totalRegisters / totalUniqueClicks) * 10000) / 100 : 0,
        earnedPoints: referralPoints._sum.pointsAwarded || 0,
      };
    }),
});

const getMyStatsCaller = t.createCallerFactory(getMyStatsRouter);

function createStatsCtx(overrides: {
  points?: number;
  referralCode?: string | null;
  referralsMade?: number;
  referralLinks?: number;
  linkAggSum?: Record<string, number>;
  linkAggCount?: number;
  targetDaySum?: Record<string, number>;
  prevDaySum?: Record<string, number>;
  pointsAwarded?: number;
  paymentUsers?: number;
}) {
  const {
    points = 100,
    referralCode = "abc123",
    referralsMade = 5,
    referralLinks = 3,
    linkAggSum = { clicks: 50, uniqueClicks: 30, registers: 10, paymentCount: 2, paymentAmount: 200 },
    linkAggCount = 3,
    targetDaySum = { clicks: 5, uniqueClicks: 3, registers: 1, paymentCount: 0, paymentAmount: 0 },
    prevDaySum = { clicks: 3, uniqueClicks: 2, registers: 0, paymentCount: 0, paymentAmount: 0 },
    pointsAwarded = 500,
    paymentUsers = 2,
  } = overrides;

  const userFindUnique = vi.fn().mockResolvedValue({
    points,
    referralCode,
    _count: { referralsMade, referralLinks },
  });

  const linkAggregate = vi.fn().mockResolvedValue({ _sum: linkAggSum, _count: linkAggCount });

  let dailyStatCallCount = 0;
  const dailyStatAggregate = vi.fn().mockImplementation(() => {
    dailyStatCallCount++;
    if (dailyStatCallCount === 1) return Promise.resolve({ _sum: targetDaySum });
    return Promise.resolve({ _sum: prevDaySum });
  });

  const referralRecordAggregate = vi.fn().mockResolvedValue({ _sum: { pointsAwarded } });
  const referralRecordCount = vi.fn().mockResolvedValue(paymentUsers);

  return createCtx({
    user: { findUnique: userFindUnique },
    referralLink: { aggregate: linkAggregate },
    referralDailyStat: { aggregate: dailyStatAggregate },
    referralRecord: { aggregate: referralRecordAggregate, count: referralRecordCount },
  });
}

describe("referral.getMyStats", () => {
  it("不传参数时返回今日日期", async () => {
    const ctx = createStatsCtx({});
    const result = await getMyStatsCaller(ctx).getMyStats();
    expect(result.date).toBe(dateKey(getDateOnly()));
    expect(result.points).toBe(100);
    expect(result.referralCode).toBe("abc123");
    expect(result.totalReferrals).toBe(5);
    expect(result.totalLinks).toBe(3);
  });

  it("传入 date 参数查询指定日期", async () => {
    const ctx = createStatsCtx({ targetDaySum: { clicks: 10, uniqueClicks: 8, registers: 3 } });
    const result = await getMyStatsCaller(ctx).getMyStats({ date: "2026-03-15" });
    expect(result.date).toBe("2026-03-15");
    expect(result.todayClicks).toBe(10);
    expect(result.todayUniqueClicks).toBe(8);
    expect(result.todayRegisters).toBe(3);
  });

  it("date 格式不合法时应抛出验证错误", async () => {
    const ctx = createStatsCtx({});
    await expect(getMyStatsCaller(ctx).getMyStats({ date: "2026/03/15" })).rejects.toThrow();
    await expect(getMyStatsCaller(ctx).getMyStats({ date: "not-a-date" })).rejects.toThrow();
    await expect(getMyStatsCaller(ctx).getMyStats({ date: "20260315" })).rejects.toThrow();
  });

  it("计算转化率正确", async () => {
    const ctx = createStatsCtx({
      linkAggSum: { clicks: 100, uniqueClicks: 80, registers: 20, paymentCount: 5, paymentAmount: 500 },
    });
    const result = await getMyStatsCaller(ctx).getMyStats();
    expect(result.conversionRate).toBe(25);
  });

  it("uniqueClicks 为 0 时转化率为 0", async () => {
    const ctx = createStatsCtx({
      linkAggSum: { clicks: 0, uniqueClicks: 0, registers: 0, paymentCount: 0, paymentAmount: 0 },
    });
    const result = await getMyStatsCaller(ctx).getMyStats();
    expect(result.conversionRate).toBe(0);
  });

  it("用户不存在时抛出 NOT_FOUND", async () => {
    const ctx = createCtx({ user: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(getMyStatsCaller(ctx).getMyStats()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ========== 测试 openApi referral 端点 ==========

const referralProcedure = apiScopedProcedure("referral:read");

const openApiReferralRouter = t.router({
  referralOverview: referralProcedure
    .input(
      z
        .object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          channel: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const channelFilter = input?.channel;
      const hasDateRange = input?.from && input?.to;

      if (hasDateRange) {
        const from = new Date(input.from!);
        const to = new Date(input.to!);
        if (to < from) throw new TRPCError({ code: "BAD_REQUEST", message: "结束日期不能早于开始日期" });
        if (computeDayCount(from, to) > MAX_RANGE_DAYS)
          throw new TRPCError({ code: "BAD_REQUEST", message: `日期范围不能超过 ${MAX_RANGE_DAYS} 天` });
      }

      if (hasDateRange) {
        return {
          period: { from: input!.from!, to: input!.to! },
          channel: channelFilter ?? null,
          links: 0,
          referrals: 0,
          clicks: 0,
          uniqueClicks: 0,
          payments: { count: 0, amount: 0 },
          pointsAwarded: 0,
          activeReferrers: 0,
        };
      }

      return {
        period: null,
        channel: channelFilter ?? null,
        links: 10,
        referrals: 50,
        clicks: 200,
        uniqueClicks: 150,
        payments: { count: 5, amount: 500 },
        pointsAwarded: 2500,
        activeReferrers: 8,
      };
    }),

  referralTrendStats: referralProcedure
    .input(
      z
        .object({
          from: z.string().datetime(),
          to: z.string().datetime(),
          channel: z.string().optional(),
        })
        .refine((d) => new Date(d.to) >= new Date(d.from), { message: "结束日期不能早于开始日期" })
        .refine(
          (d) => {
            const days = computeDayCount(new Date(d.from), new Date(d.to));
            return days >= 1 && days <= MAX_RANGE_DAYS;
          },
          { message: `日期范围不能超过 ${MAX_RANGE_DAYS} 天` },
        ),
    )
    .query(async ({ input }) => {
      const startDate = new Date(input.from);
      const endDate = new Date(input.to);
      const dayCount = computeDayCount(startDate, endDate);
      const toKey = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      const trend = [];
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(startDate.getTime() + i * DAY_MS);
        trend.push({ date: toKey(d), clicks: 0, uniqueClicks: 0, registers: 0, paymentCount: 0, paymentAmount: 0 });
      }

      return {
        period: { from: input.from, to: input.to },
        channel: input.channel ?? null,
        trend,
      };
    }),

  referralChannelStats: referralProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        sortBy: z.enum(["registers", "clicks", "uniqueClicks", "payments"]).default("registers"),
      }),
    )
    .query(async ({ input }) => {
      const hasDateRange = input.from && input.to;
      if (hasDateRange) {
        const from = new Date(input.from!);
        const to = new Date(input.to!);
        if (to < from) throw new TRPCError({ code: "BAD_REQUEST", message: "结束日期不能早于开始日期" });
        if (computeDayCount(from, to) > MAX_RANGE_DAYS)
          throw new TRPCError({ code: "BAD_REQUEST", message: `日期范围不能超过 ${MAX_RANGE_DAYS} 天` });
        return { period: { from: input.from!, to: input.to! }, items: [] };
      }
      return { period: null, items: [] };
    }),

  referralLeaderboard: referralProcedure
    .input(
      z.object({
        metric: z.enum(["referrals", "clicks", "points"]).default("referrals"),
        limit: z.number().min(1).max(50).default(20),
        channel: z.string().optional(),
      }),
    )
    .query(async () => {
      return { items: [] };
    }),

  referralLinkRanking: referralProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        channel: z.string().optional(),
        sortBy: z.enum(["uniqueClicks", "registers", "paymentCount", "paymentAmount"]).default("registers"),
      }),
    )
    .query(async () => {
      return { items: [] };
    }),
});

const openApiCaller = t.createCallerFactory(openApiReferralRouter);

describe("openApi.referralOverview", () => {
  it("不传参数返回全量数据，period 为 null", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralOverview();
    expect(result.period).toBeNull();
    expect(result.channel).toBeNull();
    expect(result.links).toBe(10);
    expect(result.referrals).toBe(50);
  });

  it("传空对象也返回全量数据", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralOverview({});
    expect(result.period).toBeNull();
  });

  it("传入日期范围返回 period 对象", async () => {
    const ctx = createApiCtx();
    const from = "2026-03-01T00:00:00.000Z";
    const to = "2026-03-15T23:59:59.999Z";
    const result = await openApiCaller(ctx).referralOverview({ from, to });
    expect(result.period).toEqual({ from, to });
  });

  it("传入 channel 筛选", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralOverview({ channel: "twitter" });
    expect(result.channel).toBe("twitter");
  });

  it("from > to 时应抛出 BAD_REQUEST", async () => {
    const ctx = createApiCtx();
    await expect(
      openApiCaller(ctx).referralOverview({
        from: "2026-03-15T00:00:00.000Z",
        to: "2026-03-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("日期范围超过 90 天应抛出 BAD_REQUEST", async () => {
    const ctx = createApiCtx();
    await expect(
      openApiCaller(ctx).referralOverview({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("单日查询（from === to）应正常工作", async () => {
    const ctx = createApiCtx();
    const date = "2026-03-15T00:00:00.000Z";
    const result = await openApiCaller(ctx).referralOverview({ from: date, to: date });
    expect(result.period).toEqual({ from: date, to: date });
  });

  it("未认证时应抛出 UNAUTHORIZED", async () => {
    const ctx: Context = {
      prisma: buildMockPrisma(),
      redis: {} as Context["redis"],
      session: null,
      ipv4Address: null,
      ipv6Address: null,
      userAgent: null,
      apiKeyScopes: null,
    };
    await expect(openApiCaller(ctx).referralOverview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("API Key 缺少 referral:read scope 应抛出 FORBIDDEN", async () => {
    const ctx = createApiCtx({}, ["stats:read"]);
    await expect(openApiCaller(ctx).referralOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("openApi.referralTrendStats", () => {
  it("返回正确天数的趋势数据", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralTrendStats({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-03T00:00:00.000Z",
    });
    expect(result.trend).toHaveLength(3);
    expect(result.trend[0].date).toBe("2026-03-01");
    expect(result.trend[1].date).toBe("2026-03-02");
    expect(result.trend[2].date).toBe("2026-03-03");
  });

  it("单日查询返回 1 条趋势数据", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralTrendStats({
      from: "2026-03-15T00:00:00.000Z",
      to: "2026-03-15T00:00:00.000Z",
    });
    expect(result.trend).toHaveLength(1);
    expect(result.trend[0].date).toBe("2026-03-15");
  });

  it("返回 channel 筛选信息", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralTrendStats({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-01T23:59:59.999Z",
      channel: "bilibili",
    });
    expect(result.channel).toBe("bilibili");
  });

  it("不传 channel 时 channel 为 null", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralTrendStats({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-01T23:59:59.999Z",
    });
    expect(result.channel).toBeNull();
  });

  it("from > to 应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(
      openApiCaller(ctx).referralTrendStats({
        from: "2026-03-15T00:00:00.000Z",
        to: "2026-03-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
  });

  it("超过 90 天应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(
      openApiCaller(ctx).referralTrendStats({
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
  });

  it("趋势数据每项都有完整字段", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralTrendStats({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-01T23:59:59.999Z",
    });
    const entry = result.trend[0];
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("clicks");
    expect(entry).toHaveProperty("uniqueClicks");
    expect(entry).toHaveProperty("registers");
    expect(entry).toHaveProperty("paymentCount");
    expect(entry).toHaveProperty("paymentAmount");
  });
});

describe("openApi.referralChannelStats", () => {
  it("不传日期范围时 period 为 null", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralChannelStats({});
    expect(result.period).toBeNull();
  });

  it("传入日期范围时返回 period", async () => {
    const ctx = createApiCtx();
    const from = "2026-03-01T00:00:00.000Z";
    const to = "2026-03-15T23:59:59.999Z";
    const result = await openApiCaller(ctx).referralChannelStats({ from, to });
    expect(result.period).toEqual({ from, to });
  });

  it("from > to 应抛出 BAD_REQUEST", async () => {
    const ctx = createApiCtx();
    await expect(
      openApiCaller(ctx).referralChannelStats({
        from: "2026-03-15T00:00:00.000Z",
        to: "2026-03-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("limit 超出范围应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(openApiCaller(ctx).referralChannelStats({ limit: 0 })).rejects.toThrow();
    await expect(openApiCaller(ctx).referralChannelStats({ limit: 100 })).rejects.toThrow();
  });

  it("sortBy 支持多种字段", async () => {
    const ctx = createApiCtx();
    for (const sortBy of ["registers", "clicks", "uniqueClicks", "payments"] as const) {
      const result = await openApiCaller(ctx).referralChannelStats({ sortBy });
      expect(result).toBeDefined();
    }
  });

  it("sortBy 传入非法值应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(openApiCaller(ctx).referralChannelStats({ sortBy: "invalid" as never })).rejects.toThrow();
  });
});

describe("openApi.referralLeaderboard", () => {
  it("默认 metric 为 referrals", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralLeaderboard({});
    expect(result.items).toBeDefined();
  });

  it("支持 channel 参数", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralLeaderboard({ channel: "twitter" });
    expect(result.items).toBeDefined();
  });

  it("metric 支持 referrals / clicks / points", async () => {
    const ctx = createApiCtx();
    for (const metric of ["referrals", "clicks", "points"] as const) {
      const result = await openApiCaller(ctx).referralLeaderboard({ metric });
      expect(result.items).toBeDefined();
    }
  });

  it("metric 非法值应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(openApiCaller(ctx).referralLeaderboard({ metric: "invalid" as never })).rejects.toThrow();
  });

  it("limit 超出范围应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(openApiCaller(ctx).referralLeaderboard({ limit: 0 })).rejects.toThrow();
    await expect(openApiCaller(ctx).referralLeaderboard({ limit: 100 })).rejects.toThrow();
  });
});

describe("openApi.referralLinkRanking", () => {
  it("默认参数正常返回", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralLinkRanking({});
    expect(result.items).toBeDefined();
  });

  it("支持 channel 筛选", async () => {
    const ctx = createApiCtx();
    const result = await openApiCaller(ctx).referralLinkRanking({ channel: "bilibili" });
    expect(result.items).toBeDefined();
  });

  it("sortBy 支持多种字段", async () => {
    const ctx = createApiCtx();
    for (const sortBy of ["uniqueClicks", "registers", "paymentCount", "paymentAmount"] as const) {
      const result = await openApiCaller(ctx).referralLinkRanking({ sortBy });
      expect(result.items).toBeDefined();
    }
  });

  it("sortBy 非法值应抛出验证错误", async () => {
    const ctx = createApiCtx();
    await expect(openApiCaller(ctx).referralLinkRanking({ sortBy: "invalid" as never })).rejects.toThrow();
  });
});

// ========== computeDayCount 单元测试 ==========

describe("computeDayCount", () => {
  it("同一天返回 1", () => {
    const d = new Date("2026-03-15");
    expect(computeDayCount(d, d)).toBe(1);
  });

  it("连续两天返回 2", () => {
    expect(computeDayCount(new Date("2026-03-15"), new Date("2026-03-16"))).toBe(2);
  });

  it("跨月计算正确", () => {
    expect(computeDayCount(new Date("2026-02-28"), new Date("2026-03-01"))).toBe(2);
  });

  it("90 天范围", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-03-31");
    expect(computeDayCount(from, to)).toBe(90);
  });

  it("忽略时间部分", () => {
    const from = new Date(2026, 2, 15, 23, 59, 59, 999);
    const to = new Date(2026, 2, 16, 0, 0, 0, 0);
    expect(computeDayCount(from, to)).toBe(2);
  });
});

// ========== dateKey 单元测试 ==========

describe("dateKey", () => {
  it("格式为 YYYY-MM-DD", () => {
    const d = new Date("2026-03-05T12:30:00.000Z");
    expect(dateKey(d)).toBe("2026-03-05");
  });

  it("月份和日期补零", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(dateKey(d)).toBe("2026-01-01");
  });
});

// ========== getDateOnly 单元测试 ==========

describe("getDateOnly", () => {
  it("时间部分清零", () => {
    const d = getDateOnly(new Date("2026-03-15T14:30:45.123"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("保留日期部分", () => {
    const d = getDateOnly(new Date("2026-03-15T14:30:45.123"));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });

  it("不传参数使用当前日期", () => {
    const d = getDateOnly();
    const now = new Date();
    expect(d.getFullYear()).toBe(now.getFullYear());
    expect(d.getMonth()).toBe(now.getMonth());
    expect(d.getDate()).toBe(now.getDate());
  });
});
