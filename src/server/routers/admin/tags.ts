import { router, adminProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { deleteCachePattern } from "@/lib/redis";

export const adminTagsRouter = router({
  // ========== 标签分类管理 ==========

  listTagCategories: adminProcedure.use(requireScope("tag:manage")).query(async ({ ctx }) => {
    return ctx.prisma.tagCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { tags: true } } },
    });
  }),

  createTagCategory: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      name: z.string().min(1).max(30),
      slug: z.string().min(1).max(30),
      color: z.string().max(20).default("#6366f1"),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.tagCategory.findFirst({
        where: { OR: [{ name: input.name }, { slug: input.slug }] },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "分类名称或 slug 已存在" });

      const cat = await ctx.prisma.tagCategory.create({ data: input });
      await deleteCachePattern("tag:*");
      return { success: true, category: cat };
    }),

  updateTagCategory: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(30).optional(),
      slug: z.string().min(1).max(30).optional(),
      color: z.string().max(20).optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const cat = await ctx.prisma.tagCategory.update({ where: { id }, data });
      await deleteCachePattern("tag:*");
      return { success: true, category: cat };
    }),

  deleteTagCategory: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tagCategory.delete({ where: { id: input.id } });
      await deleteCachePattern("tag:*");
      return { success: true };
    }),

  // ========== 标签管理 ==========

  getTagStats: adminProcedure.use(requireScope("tag:manage")).query(async ({ ctx }) => {
    const [tags, categoryCount] = await Promise.all([
      ctx.prisma.tag.findMany({
        select: { categoryId: true, _count: { select: { videos: true, games: true, imagePosts: true } } },
      }),
      ctx.prisma.tagCategory.count(),
    ]);

    const total = tags.length;
    const withVideos = tags.filter((t) => t._count.videos > 0).length;
    const withGames = tags.filter((t) => t._count.games > 0).length;
    const withImages = tags.filter((t) => t._count.imagePosts > 0).length;
    const empty = tags.filter((t) => t._count.videos === 0 && t._count.games === 0 && t._count.imagePosts === 0).length;
    const uncategorized = tags.filter((t) => !t.categoryId).length;

    return { total, withVideos, withGames, withImages, empty, uncategorized, categoryCount };
  }),

  createTag: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      name: z.string().min(1).max(50),
      slug: z.string().min(1).max(50).optional(),
      categoryId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "");

      const existing = await ctx.prisma.tag.findFirst({
        where: { OR: [{ name: input.name }, { slug }] },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "标签名称或 slug 已存在" });

      const tag = await ctx.prisma.tag.create({
        data: { name: input.name, slug, categoryId: input.categoryId || null },
      });
      await deleteCachePattern("tag:*");

      return { success: true, tag };
    }),

  listTags: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      page: z.number().min(1).default(1),
      search: z.string().optional(),
      categoryId: z.string().optional(),
      uncategorized: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const conditions: Prisma.TagWhereInput[] = [];

      if (input.search) {
        conditions.push({
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ],
        });
      }
      if (input.uncategorized) {
        conditions.push({ categoryId: null });
      } else if (input.categoryId) {
        conditions.push({ categoryId: input.categoryId });
      }

      const where: Prisma.TagWhereInput = conditions.length > 0 ? { AND: conditions } : {};

      const [tags, totalCount] = await Promise.all([
        ctx.prisma.tag.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          include: {
            category: true,
            _count: { select: { videos: true, games: true, imagePosts: true } },
          },
        }),
        ctx.prisma.tag.count({ where }),
      ]);

      return {
        tags,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  updateTag: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      tagId: z.string(),
      name: z.string().min(1).max(50).optional(),
      slug: z.string().min(1).max(50).optional(),
      categoryId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { tagId, ...data } = input;
      const tag = await ctx.prisma.tag.update({ where: { id: tagId }, data });
      await deleteCachePattern("tag:*");

      return { success: true, tag };
    }),

  // 批量修改标签分类
  batchUpdateTagCategory: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      tagIds: z.array(z.string()).min(1).max(100),
      categoryId: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.tag.updateMany({
        where: { id: { in: input.tagIds } },
        data: { categoryId: input.categoryId },
      });
      await deleteCachePattern("tag:*");

      return { success: true, count: result.count };
    }),

  deleteTag: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tag.delete({ where: { id: input.tagId } });
      await deleteCachePattern("tag:*");

      return { success: true };
    }),

  batchDeleteTags: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ tagIds: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.tag.deleteMany({
        where: { id: { in: input.tagIds } },
      });
      await deleteCachePattern("tag:*");

      return { success: true, count: result.count };
    }),

  mergeTags: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({
      sourceTagIds: z.array(z.string()).min(1).max(100),
      targetTagId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const targetTag = await ctx.prisma.tag.findUnique({ where: { id: input.targetTagId } });
      if (!targetTag) throw new TRPCError({ code: "NOT_FOUND", message: "目标标签不存在" });

      const sourceVideos = await ctx.prisma.video.findMany({
        where: { tags: { some: { tagId: { in: input.sourceTagIds } } } },
        select: { id: true },
      });

      for (const video of sourceVideos) {
        await ctx.prisma.tagOnVideo.upsert({
          where: { videoId_tagId: { videoId: video.id, tagId: input.targetTagId } },
          create: { videoId: video.id, tagId: input.targetTagId },
          update: {},
        });
        await ctx.prisma.tagOnVideo.deleteMany({
          where: { videoId: video.id, tagId: { in: input.sourceTagIds } },
        });
      }

      const sourceGames = await ctx.prisma.game.findMany({
        where: { tags: { some: { tagId: { in: input.sourceTagIds } } } },
        select: { id: true },
      });

      for (const game of sourceGames) {
        await ctx.prisma.tagOnGame.upsert({
          where: { gameId_tagId: { gameId: game.id, tagId: input.targetTagId } },
          create: { gameId: game.id, tagId: input.targetTagId },
          update: {},
        });
        await ctx.prisma.tagOnGame.deleteMany({
          where: { gameId: game.id, tagId: { in: input.sourceTagIds } },
        });
      }

      await ctx.prisma.tag.deleteMany({ where: { id: { in: input.sourceTagIds } } });
      await deleteCachePattern("tag:*");

      return { success: true, mergedCount: input.sourceTagIds.length };
    }),

});
