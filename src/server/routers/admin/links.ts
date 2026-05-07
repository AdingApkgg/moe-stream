import { router, adminProcedure, requireScope } from "../../trpc";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

// 与 site.ts / 评论模块保持一致：仅校验协议前缀，避免 z.string().url() 拒绝
// 含畸形 Punycode 的合法主机（例如 xn--biroov.xoavxo028.sbs）
const urlRegex = /^https?:\/\/.+/;

export const adminLinksRouter = router({
  // ========== 友情链接管理 ==========

  listFriendLinks: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z
        .object({
          orderBy: z.enum(["sort", "clicks", "uniqueClicks", "lastClickedAt", "createdAt"]).default("sort"),
          order: z.enum(["asc", "desc"]).default("desc"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orderBy = input?.orderBy ?? "sort";
      const order = input?.order ?? "desc";
      // 默认按 sort + createdAt；其他维度排序时把 createdAt 作为兜底
      // lastClickedAt 可空，让 NULL 排在最后
      const primary: Prisma.FriendLinkOrderByWithRelationInput =
        orderBy === "lastClickedAt" ? { lastClickedAt: { sort: order, nulls: "last" } } : { [orderBy]: order };
      return ctx.prisma.friendLink.findMany({
        orderBy: [primary, { createdAt: "desc" }],
      });
    }),

  // 获取友情链接的每日点击统计（用于趋势图）
  getFriendLinkStats: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        id: z.string(),
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (input.days - 1));

      const [link, stats] = await Promise.all([
        ctx.prisma.friendLink.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            clicks: true,
            uniqueClicks: true,
            lastClickedAt: true,
          },
        }),
        ctx.prisma.friendLinkDailyStat.findMany({
          where: { friendLinkId: input.id, date: { gte: since } },
          orderBy: { date: "asc" },
          select: { date: true, clicks: true, uniqueClicks: true },
        }),
      ]);

      return { link, stats };
    }),

  // 重置某条友链的累计统计（不删除每日明细）
  resetFriendLinkStats: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.friendLink.update({
        where: { id: input.id },
        data: { clicks: 0, uniqueClicks: 0, lastClickedAt: null },
      });
      return { success: true };
    }),

  createFriendLink: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        name: z.string().min(1).max(100),
        url: z.string().refine((v) => urlRegex.test(v), { message: "请输入有效的网址（以 http:// 或 https:// 开头）" }),
        logo: z
          .string()
          .refine((v) => !v || urlRegex.test(v), { message: "Logo 地址格式不正确" })
          .optional(),
        description: z.string().max(200).optional(),
        sort: z.number().int().default(0),
        visible: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.friendLink.create({ data: input });
    }),

  updateFriendLink: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        url: z
          .string()
          .refine((v) => urlRegex.test(v), { message: "请输入有效的网址（以 http:// 或 https:// 开头）" })
          .optional(),
        logo: z
          .string()
          .refine((v) => !v || urlRegex.test(v), { message: "Logo 地址格式不正确" })
          .optional(),
        description: z.string().max(200).optional(),
        sort: z.number().int().optional(),
        visible: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.friendLink.update({ where: { id }, data });
    }),

  deleteFriendLink: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.friendLink.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
