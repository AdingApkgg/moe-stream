import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { generateUniqueAmount, generateOrderNo, releaseAmount } from "@/lib/usdt-payment";

type TxClient = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0];

async function updateReferralPaymentStats(
  tx: TxClient,
  referralLinkId: string,
  userId: string,
  amount: number,
) {
  const link = await tx.referralLink.findUnique({
    where: { id: referralLinkId },
    select: { userId: true },
  });
  if (!link) return;

  await tx.referralLink.update({
    where: { id: referralLinkId },
    data: {
      paymentCount: { increment: 1 },
      paymentAmount: { increment: amount },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await tx.referralDailyStat.upsert({
    where: { referralLinkId_date: { referralLinkId, date: today } },
    create: {
      referralLinkId,
      userId: link.userId,
      date: today,
      paymentCount: 1,
      paymentAmount: amount,
    },
    update: {
      paymentCount: { increment: 1 },
      paymentAmount: { increment: amount },
    },
  });

  await tx.referralRecord.updateMany({
    where: { referredUserId: userId, referralLinkId, hasPaid: false },
    data: { hasPaid: true, firstPaidAt: new Date() },
  });
}

export const paymentRouter = router({
  // ========== 用户端 ==========

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: {
        usdtPaymentEnabled: true,
        usdtPointsPerUnit: true,
        usdtMinAmount: true,
        usdtMaxAmount: true,
        usdtOrderTimeoutMin: true,
      },
    });
    return config;
  }),

  getPackages: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.paymentPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }),

  createOrder: protectedProcedure
    .input(
      z.object({
        packageId: z.string().optional(),
        customAmount: z.number().min(0.01).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.prisma.siteConfig.findUnique({
        where: { id: "default" },
        select: {
          usdtPaymentEnabled: true,
          usdtWalletAddress: true,
          usdtPointsPerUnit: true,
          usdtOrderTimeoutMin: true,
          usdtMinAmount: true,
          usdtMaxAmount: true,
        },
      });

      if (!config?.usdtPaymentEnabled || !config.usdtWalletAddress) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "USDT 支付未启用" });
      }

      const pendingCount = await ctx.prisma.paymentOrder.count({
        where: { userId: ctx.session.user.id, status: "PENDING" },
      });
      if (pendingCount >= 3) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "最多同时存在 3 个待支付订单，请先取消或等待过期" });
      }

      let baseAmount: number;
      let pointsAmount: number;
      let grantUpload = false;
      let packageId: string | undefined;
      let description: string | undefined;

      if (input.packageId) {
        const pkg = await ctx.prisma.paymentPackage.findUnique({
          where: { id: input.packageId },
        });
        if (!pkg || !pkg.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "套餐不存在或已下架" });
        }
        baseAmount = pkg.amount;
        pointsAmount = pkg.pointsAmount;
        grantUpload = pkg.grantUpload;
        packageId = pkg.id;
        description = pkg.name;
      } else if (input.customAmount) {
        baseAmount = Math.round(input.customAmount * 100) / 100;
        if (config.usdtMinAmount && baseAmount < config.usdtMinAmount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `最低充值 ${config.usdtMinAmount} USDT` });
        }
        if (config.usdtMaxAmount && baseAmount > config.usdtMaxAmount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `最高充值 ${config.usdtMaxAmount} USDT` });
        }
        pointsAmount = Math.floor(baseAmount * config.usdtPointsPerUnit);
        description = `自定义充值 ${baseAmount} USDT`;
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请选择套餐或输入自定义金额" });
      }

      const timeoutSec = config.usdtOrderTimeoutMin * 60;
      const amount = await generateUniqueAmount(baseAmount, timeoutSec);
      const orderNo = generateOrderNo();
      const expiresAt = new Date(Date.now() + timeoutSec * 1000);

      const referralRecord = await ctx.prisma.referralRecord.findUnique({
        where: { referredUserId: ctx.session.user.id },
        select: { referralLinkId: true },
      });

      const order = await ctx.prisma.paymentOrder.create({
        data: {
          userId: ctx.session.user.id,
          orderNo,
          amount,
          baseAmount,
          walletAddress: config.usdtWalletAddress,
          packageId,
          referralLinkId: referralRecord?.referralLinkId ?? null,
          pointsAmount,
          grantUpload,
          description,
          expiresAt,
        },
      });

      return {
        id: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        walletAddress: order.walletAddress,
        pointsAmount: order.pointsAmount,
        grantUpload: order.grantUpload,
        expiresAt: order.expiresAt,
        description: order.description,
      };
    }),

  checkOrderStatus: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.paymentOrder.findFirst({
        where: { id: input.orderId, userId: ctx.session.user.id },
        select: {
          id: true,
          orderNo: true,
          status: true,
          amount: true,
          pointsAmount: true,
          grantUpload: true,
          paidAt: true,
          txHash: true,
          expiresAt: true,
        },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      return order;
    }),

  getMyOrders: protectedProcedure
    .input(z.object({ page: z.number().min(1).default(1), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;
      const [orders, total] = await Promise.all([
        ctx.prisma.paymentOrder.findMany({
          where: { userId: ctx.session.user.id },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            orderNo: true,
            amount: true,
            baseAmount: true,
            status: true,
            pointsAmount: true,
            grantUpload: true,
            description: true,
            txHash: true,
            paidAt: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        ctx.prisma.paymentOrder.count({ where: { userId: ctx.session.user.id } }),
      ]);
      return { orders, total, totalPages: Math.ceil(total / limit) };
    }),

  cancelOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.paymentOrder.findFirst({
        where: { id: input.orderId, userId: ctx.session.user.id, status: "PENDING" },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在或无法取消" });

      await ctx.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
      await releaseAmount(order.amount);
      return { success: true };
    }),

  // ========== 管理端 ==========

  adminGetStats: adminProcedure.query(async ({ ctx }) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalOrders, paidOrders, totalRevenue, todayRevenue, todayOrders, pendingOrders] =
      await Promise.all([
        ctx.prisma.paymentOrder.count(),
        ctx.prisma.paymentOrder.count({ where: { status: "PAID" } }),
        ctx.prisma.paymentOrder.aggregate({
          where: { status: "PAID" },
          _sum: { amount: true },
        }),
        ctx.prisma.paymentOrder.aggregate({
          where: { status: "PAID", paidAt: { gte: todayStart } },
          _sum: { amount: true },
        }),
        ctx.prisma.paymentOrder.count({ where: { status: "PAID", paidAt: { gte: todayStart } } }),
        ctx.prisma.paymentOrder.count({ where: { status: "PENDING" } }),
      ]);

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
      todayRevenue: todayRevenue._sum.amount || 0,
      todayOrders,
      conversionRate: totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 10000) / 100 : 0,
    };
  }),

  adminListOrders: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(["ALL", "PENDING", "PAID", "EXPIRED", "CANCELLED"]).default("ALL"),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, search } = input;
      const where: Record<string, unknown> = {};
      if (status !== "ALL") where.status = status;
      if (search) {
        where.OR = [
          { orderNo: { contains: search, mode: "insensitive" } },
          { user: { username: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { txHash: { contains: search, mode: "insensitive" } },
        ];
      }

      const [orders, total] = await Promise.all([
        ctx.prisma.paymentOrder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, username: true, nickname: true, email: true } },
            package: { select: { id: true, name: true } },
          },
        }),
        ctx.prisma.paymentOrder.count({ where }),
      ]);
      return { orders, total, totalPages: Math.ceil(total / limit) };
    }),

  adminManualConfirm: adminProcedure
    .input(z.object({ orderId: z.string(), txHash: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.paymentOrder.findUnique({ where: { id: input.orderId } });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "PENDING" && order.status !== "EXPIRED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该订单状态无法确认" });
      }

      const existingTx = await ctx.prisma.paymentOrder.findFirst({
        where: { txHash: input.txHash },
      });
      if (existingTx) throw new TRPCError({ code: "CONFLICT", message: "该交易哈希已被使用" });

      await ctx.prisma.$transaction(async (tx) => {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: "PAID", txHash: input.txHash, paidAt: new Date() },
        });

        if (order.pointsAmount > 0) {
          const user = await tx.user.update({
            where: { id: order.userId },
            data: { points: { increment: order.pointsAmount } },
            select: { points: true },
          });
          await tx.pointsTransaction.create({
            data: {
              userId: order.userId,
              amount: order.pointsAmount,
              balance: user.points,
              type: "USDT_RECHARGE",
              description: `USDT 充值（管理员确认）${order.amount} → ${order.pointsAmount} 积分`,
              relatedId: order.id,
            },
          });
        }

        if (order.grantUpload) {
          await tx.user.update({ where: { id: order.userId }, data: { canUpload: true } });
        }

        if (order.referralLinkId) {
          await updateReferralPaymentStats(tx, order.referralLinkId, order.userId, order.amount);
        }
      });

      await releaseAmount(order.amount);
      return { success: true };
    }),

  adminCancelOrder: adminProcedure
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.paymentOrder.findUnique({ where: { id: input.orderId } });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "仅待支付订单可取消" });
      }
      await ctx.prisma.paymentOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await releaseAmount(order.amount);
      return { success: true };
    }),

  // ========== 套餐管理 ==========

  adminListPackages: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.paymentPackage.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { orders: true } } },
    });
  }),

  adminCreatePackage: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        amount: z.number().min(0.01),
        pointsAmount: z.number().int().min(0),
        grantUpload: z.boolean().default(false),
        description: z.string().optional(),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.paymentPackage.create({ data: input });
    }),

  adminUpdatePackage: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        amount: z.number().min(0.01).optional(),
        pointsAmount: z.number().int().min(0).optional(),
        grantUpload: z.boolean().optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.paymentPackage.update({ where: { id }, data });
    }),

  adminDeletePackage: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const hasOrders = await ctx.prisma.paymentOrder.count({ where: { packageId: input.id } });
      if (hasOrders > 0) {
        await ctx.prisma.paymentPackage.update({
          where: { id: input.id },
          data: { isActive: false },
        });
        return { deactivated: true };
      }
      await ctx.prisma.paymentPackage.delete({ where: { id: input.id } });
      return { deleted: true };
    }),
});
