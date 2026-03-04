import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

export const redeemRouter = router({
  // ========== 管理端 ==========

  adminList: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        batchId: z.string().optional(),
        status: z.enum(["ALL", "ACTIVE", "INACTIVE", "EXPIRED"]).default("ALL"),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, batchId, status, search } = input;
      const now = new Date();

      const where: Record<string, unknown> = {};
      if (batchId) where.batchId = batchId;
      if (search) {
        where.OR = [
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }
      if (status === "ACTIVE") {
        where.isActive = true;
        where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
      } else if (status === "INACTIVE") {
        where.isActive = false;
      } else if (status === "EXPIRED") {
        where.expiresAt = { lte: now };
      }

      const [codes, totalCount] = await Promise.all([
        ctx.prisma.redeemCode.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { redemptions: true } } },
        }),
        ctx.prisma.redeemCode.count({ where }),
      ]);

      return {
        codes,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  adminCreate: adminProcedure
    .input(
      z.object({
        code: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[A-Za-z0-9_-]+$/, "兑换码只能包含字母、数字、下划线和横杠"),
        description: z.string().max(200).optional(),
        pointsAmount: z.number().int().min(0).max(1000000).default(0),
        grantUpload: z.boolean().default(false),
        maxUses: z.number().int().min(0).max(1000000).default(1),
        expiresAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.redeemCode.findUnique({
        where: { code: input.code },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "该兑换码已存在" });
      }

      return ctx.prisma.redeemCode.create({
        data: {
          code: input.code,
          description: input.description,
          pointsAmount: input.pointsAmount,
          grantUpload: input.grantUpload,
          maxUses: input.maxUses,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
    }),

  adminBatchCreate: adminProcedure
    .input(
      z.object({
        count: z.number().int().min(1).max(500),
        prefix: z.string().max(20).default(""),
        codeLength: z.number().int().min(6).max(20).default(8),
        description: z.string().max(200).optional(),
        pointsAmount: z.number().int().min(0).max(1000000).default(0),
        grantUpload: z.boolean().default(false),
        maxUses: z.number().int().min(0).max(1000000).default(1),
        expiresAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const batchId = nanoid(12);
      const codes: string[] = [];
      const existingCodes = new Set<string>();

      const allExisting = await ctx.prisma.redeemCode.findMany({
        where: { code: { startsWith: input.prefix } },
        select: { code: true },
      });
      for (const e of allExisting) existingCodes.add(e.code);

      let attempts = 0;
      while (codes.length < input.count && attempts < input.count * 10) {
        attempts++;
        const code = input.prefix + nanoid(input.codeLength).toUpperCase();
        if (!existingCodes.has(code)) {
          existingCodes.add(code);
          codes.push(code);
        }
      }

      if (codes.length < input.count) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "无法生成足够的唯一兑换码",
        });
      }

      await ctx.prisma.redeemCode.createMany({
        data: codes.map((code) => ({
          code,
          batchId,
          description: input.description,
          pointsAmount: input.pointsAmount,
          grantUpload: input.grantUpload,
          maxUses: input.maxUses,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })),
      });

      return { batchId, count: codes.length, codes };
    }),

  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        description: z.string().max(200).optional(),
        pointsAmount: z.number().int().min(0).max(1000000).optional(),
        grantUpload: z.boolean().optional(),
        maxUses: z.number().int().min(0).max(1000000).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, expiresAt, ...rest } = input;
      const data: Record<string, unknown> = { ...rest };
      if (expiresAt !== undefined) {
        data.expiresAt = expiresAt ? new Date(expiresAt) : null;
      }
      return ctx.prisma.redeemCode.update({ where: { id }, data });
    }),

  adminDelete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeemCode.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ========== 用户端 ==========

  redeem: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const code = input.code.trim();

      const result = await ctx.prisma.$transaction(async (tx) => {
        const redeemCode = await tx.redeemCode.findUnique({
          where: { code },
        });

        if (!redeemCode) {
          throw new TRPCError({ code: "NOT_FOUND", message: "兑换码不存在" });
        }
        if (!redeemCode.isActive) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该兑换码已停用" });
        }
        if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该兑换码已过期" });
        }
        if (redeemCode.maxUses > 0 && redeemCode.usedCount >= redeemCode.maxUses) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该兑换码已达到使用上限" });
        }

        const existingRedemption = await tx.redeemCodeRedemption.findUnique({
          where: { codeId_userId: { codeId: redeemCode.id, userId } },
        });
        if (existingRedemption) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "你已经使用过该兑换码" });
        }

        await tx.redeemCode.update({
          where: { id: redeemCode.id },
          data: { usedCount: { increment: 1 } },
        });

        await tx.redeemCodeRedemption.create({
          data: { codeId: redeemCode.id, userId },
        });

        const rewards: string[] = [];

        if (redeemCode.pointsAmount > 0) {
          const updated = await tx.user.update({
            where: { id: userId },
            data: { points: { increment: redeemCode.pointsAmount } },
            select: { points: true },
          });
          await tx.pointsTransaction.create({
            data: {
              userId,
              amount: redeemCode.pointsAmount,
              balance: updated.points,
              type: "REDEEM_CODE",
              description: `兑换码: ${redeemCode.code}`,
              relatedId: redeemCode.id,
            },
          });
          rewards.push(`${redeemCode.pointsAmount} 积分`);
        }

        if (redeemCode.grantUpload) {
          await tx.user.update({
            where: { id: userId },
            data: { canUpload: true },
          });
          rewards.push("投稿权限");
        }

        return { rewards };
      });

      return result;
    }),
});
