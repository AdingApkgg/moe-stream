import { router, adminProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isOwner as isOwnerRole } from "@/lib/permissions";
import { safeSync } from "@/lib/meilisearch";
import { syncUser } from "@/lib/search-sync";

export const adminUsersRouter = router({
  // ========== 用户管理（站长专用）==========

  // 用户统计
  getUserStats: adminProcedure.use(requireScope("user:view")).query(async ({ ctx }) => {
    const [total, users, admins, owners, banned] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.count({ where: { role: "USER" } }),
      ctx.prisma.user.count({ where: { role: "ADMIN" } }),
      ctx.prisma.user.count({ where: { role: "OWNER" } }),
      ctx.prisma.user.count({ where: { isBanned: true } }),
    ]);

    return { total, users, admins, owners, banned };
  }),

  // 获取用户列表（管理员可查看，站长可管理）
  listUsers: adminProcedure
    .use(requireScope("user:view"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        role: z.enum(["ALL", "USER", "ADMIN", "OWNER"]).default("ALL"),
        banned: z.enum(["ALL", "BANNED", "ACTIVE"]).default("ALL"),
        groupId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const where = {
        ...(input.role !== "ALL" && { role: input.role }),
        ...(input.banned === "BANNED" && { isBanned: true }),
        ...(input.banned === "ACTIVE" && { isBanned: false }),
        ...(input.groupId && { groupId: input.groupId }),
        ...(input.search && {
          OR: [
            { username: { contains: input.search, mode: "insensitive" as const } },
            { nickname: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [users, totalCount] = await Promise.all([
        ctx.prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            username: true,
            nickname: true,
            avatar: true,
            role: true,
            adminScopes: true,
            groupId: true,
            group: { select: { id: true, name: true, color: true } },
            isBanned: true,
            banReason: true,
            lastIpLocation: true,
            adsEnabled: true,
            createdAt: true,
            _count: { select: { videos: true, comments: true, likes: true } },
          },
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return {
        users,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  // 封禁用户
  banUser: adminProcedure
    .use(requireScope("user:manage"))
    .input(z.object({ userId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      }

      if (isOwnerRole(target.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "不能封禁站长" });
      }

      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isBanned: true, banReason: input.reason, bannedAt: new Date() },
      });

      void safeSync(syncUser(input.userId));

      return { success: true };
    }),

  // 解封用户
  unbanUser: adminProcedure
    .use(requireScope("user:manage"))
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      }

      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isBanned: false, banReason: null, bannedAt: null },
      });

      void safeSync(syncUser(input.userId));

      return { success: true };
    }),

  // 批量封禁用户
  batchBanUsers: adminProcedure
    .use(requireScope("user:manage"))
    .input(z.object({ userIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.user.updateMany({
        where: { id: { in: input.userIds }, role: { not: "OWNER" } },
        data: { isBanned: true, bannedAt: new Date() },
      });

      for (const uid of input.userIds) {
        void safeSync(syncUser(uid));
      }

      return { success: true, count: result.count };
    }),

  // 批量解封用户
  batchUnbanUsers: adminProcedure
    .use(requireScope("user:manage"))
    .input(z.object({ userIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.user.updateMany({
        where: { id: { in: input.userIds } },
        data: { isBanned: false, banReason: null, bannedAt: null },
      });

      for (const uid of input.userIds) {
        void safeSync(syncUser(uid));
      }

      return { success: true, count: result.count };
    }),
});
