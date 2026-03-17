import { router, adminProcedure, requireScope } from "../../trpc";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const adminCommentsRouter = router({
  // ========== 评论管理 ==========

  // 获取评论列表
  listComments: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        status: z.enum(["ALL", "VISIBLE", "HIDDEN", "DELETED"]).default("ALL"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const where = {
        ...(input.search && {
          OR: [
            { content: { contains: input.search, mode: "insensitive" as const } },
            { user: { username: { contains: input.search, mode: "insensitive" as const } } },
            { user: { nickname: { contains: input.search, mode: "insensitive" as const } } },
            { video: { title: { contains: input.search, mode: "insensitive" as const } } },
          ],
        }),
        ...(input.status === "VISIBLE" && { isDeleted: false, isHidden: false }),
        ...(input.status === "HIDDEN" && { isHidden: true, isDeleted: false }),
        ...(input.status === "DELETED" && { isDeleted: true }),
      };

      type AdminComment = Prisma.CommentGetPayload<{
        include: {
          user: { select: { id: true; username: true; nickname: true; avatar: true } };
          video: { select: { id: true; title: true } };
        };
      }>;

      const [comments, totalCount] = await Promise.all([
        ctx.prisma.comment.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
            video: { select: { id: true, title: true } },
          },
        }) as Promise<AdminComment[]>,
        ctx.prisma.comment.count({ where }),
      ]);

      return {
        comments,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  // 隐藏/显示评论
  toggleCommentHidden: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string(), isHidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.comment.update({
        where: { id: input.commentId },
        data: { isHidden: input.isHidden },
      });

      return { success: true };
    }),

  // 删除评论（软删除）
  deleteComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.comment.update({
        where: { id: input.commentId },
        data: { isDeleted: true },
      });

      return { success: true };
    }),

  // 恢复评论
  restoreComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.comment.update({
        where: { id: input.commentId },
        data: { isDeleted: false },
      });

      return { success: true };
    }),

  // 评论统计
  getCommentStats: adminProcedure.use(requireScope("comment:manage")).query(async ({ ctx }) => {
    const [total, visible, hidden, deleted] = await Promise.all([
      ctx.prisma.comment.count(),
      ctx.prisma.comment.count({ where: { isDeleted: false, isHidden: false } }),
      ctx.prisma.comment.count({ where: { isHidden: true, isDeleted: false } }),
      ctx.prisma.comment.count({ where: { isDeleted: true } }),
    ]);

    return { total, visible, hidden, deleted };
  }),

  // 批量评论操作
  batchCommentAction: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        commentIds: z.array(z.string()).min(1).max(100),
        action: z.enum(["hide", "show", "delete", "restore"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = (() => {
        switch (input.action) {
          case "hide":
            return { isHidden: true };
          case "show":
            return { isHidden: false };
          case "delete":
            return { isDeleted: true };
          case "restore":
            return { isDeleted: false };
        }
      })();

      const result = await ctx.prisma.comment.updateMany({
        where: { id: { in: input.commentIds } },
        data,
      });

      return { success: true, count: result.count };
    }),

  // 硬删除评论（彻底删除）
  hardDeleteComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 先删除所有子评论（回复）
      await ctx.prisma.comment.deleteMany({
        where: { parentId: input.commentId },
      });

      // 删除评论的所有反应
      await ctx.prisma.commentReaction.deleteMany({
        where: { commentId: input.commentId },
      });

      // 删除评论本身
      await ctx.prisma.comment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),

  // 批量硬删除评论
  batchHardDeleteComments: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      // 先删除所有子评论
      await ctx.prisma.comment.deleteMany({
        where: { parentId: { in: input.commentIds } },
      });

      // 删除评论的所有反应
      await ctx.prisma.commentReaction.deleteMany({
        where: { commentId: { in: input.commentIds } },
      });

      // 删除评论
      const result = await ctx.prisma.comment.deleteMany({
        where: { id: { in: input.commentIds } },
      });

      return { success: true, count: result.count };
    }),

  // ========== 游戏评论管理 ==========

  listGameComments: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        status: z.enum(["ALL", "VISIBLE", "HIDDEN", "DELETED"]).default("ALL"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const where = {
        ...(input.search && {
          OR: [
            { content: { contains: input.search, mode: "insensitive" as const } },
            { user: { username: { contains: input.search, mode: "insensitive" as const } } },
            { user: { nickname: { contains: input.search, mode: "insensitive" as const } } },
            { game: { title: { contains: input.search, mode: "insensitive" as const } } },
          ],
        }),
        ...(input.status === "VISIBLE" && { isDeleted: false, isHidden: false }),
        ...(input.status === "HIDDEN" && { isHidden: true, isDeleted: false }),
        ...(input.status === "DELETED" && { isDeleted: true }),
      };

      type AdminGameComment = Prisma.GameCommentGetPayload<{
        include: {
          user: { select: { id: true; username: true; nickname: true; avatar: true } };
          game: { select: { id: true; title: true } };
        };
      }>;

      const [comments, totalCount] = await Promise.all([
        ctx.prisma.gameComment.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
            game: { select: { id: true, title: true } },
          },
        }) as Promise<AdminGameComment[]>,
        ctx.prisma.gameComment.count({ where }),
      ]);

      return {
        comments,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  toggleGameCommentHidden: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string(), isHidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.gameComment.update({
        where: { id: input.commentId },
        data: { isHidden: input.isHidden },
      });

      return { success: true };
    }),

  deleteGameComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.gameComment.update({
        where: { id: input.commentId },
        data: { isDeleted: true },
      });

      return { success: true };
    }),

  restoreGameComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.gameComment.update({
        where: { id: input.commentId },
        data: { isDeleted: false },
      });

      return { success: true };
    }),

  getGameCommentStats: adminProcedure.use(requireScope("comment:manage")).query(async ({ ctx }) => {
    const [total, visible, hidden, deleted] = await Promise.all([
      ctx.prisma.gameComment.count(),
      ctx.prisma.gameComment.count({ where: { isDeleted: false, isHidden: false } }),
      ctx.prisma.gameComment.count({ where: { isHidden: true, isDeleted: false } }),
      ctx.prisma.gameComment.count({ where: { isDeleted: true } }),
    ]);

    return { total, visible, hidden, deleted };
  }),

  batchGameCommentAction: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        commentIds: z.array(z.string()).min(1).max(100),
        action: z.enum(["hide", "show", "delete", "restore"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = (() => {
        switch (input.action) {
          case "hide":
            return { isHidden: true };
          case "show":
            return { isHidden: false };
          case "delete":
            return { isDeleted: true };
          case "restore":
            return { isDeleted: false };
        }
      })();

      const result = await ctx.prisma.gameComment.updateMany({
        where: { id: { in: input.commentIds } },
        data,
      });

      return { success: true, count: result.count };
    }),

  hardDeleteGameComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.gameComment.deleteMany({
        where: { parentId: input.commentId },
      });

      await ctx.prisma.gameCommentReaction.deleteMany({
        where: { commentId: input.commentId },
      });

      await ctx.prisma.gameComment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),

  batchHardDeleteGameComments: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.gameComment.deleteMany({
        where: { parentId: { in: input.commentIds } },
      });

      await ctx.prisma.gameCommentReaction.deleteMany({
        where: { commentId: { in: input.commentIds } },
      });

      const result = await ctx.prisma.gameComment.deleteMany({
        where: { id: { in: input.commentIds } },
      });

      return { success: true, count: result.count };
    }),

  // ========== 图文评论管理 ==========

  listImagePostComments: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        status: z.enum(["ALL", "VISIBLE", "HIDDEN", "DELETED"]).default("ALL"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const where = {
        ...(input.search && {
          OR: [
            { content: { contains: input.search, mode: "insensitive" as const } },
            { user: { username: { contains: input.search, mode: "insensitive" as const } } },
            { user: { nickname: { contains: input.search, mode: "insensitive" as const } } },
            { imagePost: { title: { contains: input.search, mode: "insensitive" as const } } },
          ],
        }),
        ...(input.status === "VISIBLE" && { isDeleted: false, isHidden: false }),
        ...(input.status === "HIDDEN" && { isHidden: true, isDeleted: false }),
        ...(input.status === "DELETED" && { isDeleted: true }),
      };

      type AdminImagePostComment = Prisma.ImagePostCommentGetPayload<{
        include: {
          user: { select: { id: true; username: true; nickname: true; avatar: true } };
          imagePost: { select: { id: true; title: true } };
        };
      }>;

      const [comments, totalCount] = await Promise.all([
        ctx.prisma.imagePostComment.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
            imagePost: { select: { id: true, title: true } },
          },
        }) as Promise<AdminImagePostComment[]>,
        ctx.prisma.imagePostComment.count({ where }),
      ]);

      return {
        comments,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  toggleImagePostCommentHidden: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string(), isHidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.imagePostComment.update({
        where: { id: input.commentId },
        data: { isHidden: input.isHidden },
      });

      return { success: true };
    }),

  deleteImagePostComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.imagePostComment.update({
        where: { id: input.commentId },
        data: { isDeleted: true },
      });

      return { success: true };
    }),

  restoreImagePostComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.imagePostComment.update({
        where: { id: input.commentId },
        data: { isDeleted: false },
      });

      return { success: true };
    }),

  getImagePostCommentStats: adminProcedure.use(requireScope("comment:manage")).query(async ({ ctx }) => {
    const [total, visible, hidden, deleted] = await Promise.all([
      ctx.prisma.imagePostComment.count(),
      ctx.prisma.imagePostComment.count({ where: { isDeleted: false, isHidden: false } }),
      ctx.prisma.imagePostComment.count({ where: { isHidden: true, isDeleted: false } }),
      ctx.prisma.imagePostComment.count({ where: { isDeleted: true } }),
    ]);

    return { total, visible, hidden, deleted };
  }),

  batchImagePostCommentAction: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        commentIds: z.array(z.string()).min(1).max(100),
        action: z.enum(["hide", "show", "delete", "restore"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = (() => {
        switch (input.action) {
          case "hide":
            return { isHidden: true };
          case "show":
            return { isHidden: false };
          case "delete":
            return { isDeleted: true };
          case "restore":
            return { isDeleted: false };
        }
      })();

      const result = await ctx.prisma.imagePostComment.updateMany({
        where: { id: { in: input.commentIds } },
        data,
      });

      return { success: true, count: result.count };
    }),

  hardDeleteImagePostComment: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.imagePostComment.deleteMany({
        where: { parentId: input.commentId },
      });

      await ctx.prisma.imagePostCommentReaction.deleteMany({
        where: { commentId: input.commentId },
      });

      await ctx.prisma.imagePostComment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),

  batchHardDeleteImagePostComments: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ commentIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.imagePostComment.deleteMany({
        where: { parentId: { in: input.commentIds } },
      });

      await ctx.prisma.imagePostCommentReaction.deleteMany({
        where: { commentId: { in: input.commentIds } },
      });

      const result = await ctx.prisma.imagePostComment.deleteMany({
        where: { id: { in: input.commentIds } },
      });

      return { success: true, count: result.count };
    }),

  // ========== 留言板管理 ==========

  listGuestbookMessages: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        status: z.enum(["ALL", "VISIBLE", "HIDDEN", "DELETED"]).default("ALL"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const where = {
        ...(input.search && {
          OR: [
            { content: { contains: input.search, mode: "insensitive" as const } },
            { user: { username: { contains: input.search, mode: "insensitive" as const } } },
            { user: { nickname: { contains: input.search, mode: "insensitive" as const } } },
            { guestName: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
        ...(input.status === "VISIBLE" && { isDeleted: false, isHidden: false }),
        ...(input.status === "HIDDEN" && { isHidden: true, isDeleted: false }),
        ...(input.status === "DELETED" && { isDeleted: true }),
      };

      const [messages, totalCount] = await Promise.all([
        ctx.prisma.guestbookMessage.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
          },
        }),
        ctx.prisma.guestbookMessage.count({ where }),
      ]);

      return {
        messages,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  getGuestbookStats: adminProcedure.use(requireScope("comment:manage")).query(async ({ ctx }) => {
    const [total, visible, hidden, deleted] = await Promise.all([
      ctx.prisma.guestbookMessage.count(),
      ctx.prisma.guestbookMessage.count({ where: { isDeleted: false, isHidden: false } }),
      ctx.prisma.guestbookMessage.count({ where: { isHidden: true, isDeleted: false } }),
      ctx.prisma.guestbookMessage.count({ where: { isDeleted: true } }),
    ]);

    return { total, visible, hidden, deleted };
  }),

  toggleGuestbookHidden: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ messageId: z.string(), isHidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.guestbookMessage.update({
        where: { id: input.messageId },
        data: { isHidden: input.isHidden },
      });
      return { success: true };
    }),

  deleteGuestbookMessage: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.guestbookMessage.update({
        where: { id: input.messageId },
        data: { isDeleted: true },
      });
      return { success: true };
    }),

  restoreGuestbookMessage: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.guestbookMessage.update({
        where: { id: input.messageId },
        data: { isDeleted: false },
      });
      return { success: true };
    }),

  batchGuestbookAction: adminProcedure
    .use(requireScope("comment:manage"))
    .input(
      z.object({
        messageIds: z.array(z.string()).min(1).max(100),
        action: z.enum(["hide", "show", "delete", "restore"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dataMap = {
        hide: { isHidden: true },
        show: { isHidden: false },
        delete: { isDeleted: true },
        restore: { isDeleted: false },
      };

      const result = await ctx.prisma.guestbookMessage.updateMany({
        where: { id: { in: input.messageIds } },
        data: dataMap[input.action],
      });

      return { success: true, count: result.count };
    }),

  hardDeleteGuestbookMessage: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.guestbookMessage.delete({
        where: { id: input.messageId },
      });

      return { success: true };
    }),

  batchHardDeleteGuestbookMessages: adminProcedure
    .use(requireScope("comment:manage"))
    .input(z.object({ messageIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.guestbookMessage.deleteMany({
        where: { id: { in: input.messageIds } },
      });

      return { success: true, count: result.count };
    }),

});
