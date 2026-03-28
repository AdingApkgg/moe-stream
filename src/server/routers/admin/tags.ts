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
    .input(
      z.object({
        name: z.string().min(1).max(30),
        slug: z.string().min(1).max(30),
        color: z.string().max(20).default("#6366f1"),
        sortOrder: z.number().int().default(0),
        type: z.string().max(20).default("genre"),
      }),
    )
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
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(30).optional(),
        slug: z.string().min(1).max(30).optional(),
        color: z.string().max(20).optional(),
        sortOrder: z.number().int().optional(),
        type: z.string().max(20).optional(),
      }),
    )
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
    const [tagAgg, categoryCount, aliasCount, implicationCount] = await Promise.all([
      ctx.prisma.tag.aggregate({
        _count: true,
        _sum: { videoCount: true, gameCount: true, imagePostCount: true },
      }),
      ctx.prisma.tagCategory.count(),
      ctx.prisma.tagAlias.count(),
      ctx.prisma.tagImplication.count(),
    ]);

    const tags = await ctx.prisma.tag.findMany({
      select: { videoCount: true, gameCount: true, imagePostCount: true, categoryId: true },
    });

    const withVideos = tags.filter((t) => t.videoCount > 0).length;
    const withGames = tags.filter((t) => t.gameCount > 0).length;
    const withImages = tags.filter((t) => t.imagePostCount > 0).length;
    const empty = tags.filter((t) => t.videoCount === 0 && t.gameCount === 0 && t.imagePostCount === 0).length;
    const uncategorized = tags.filter((t) => !t.categoryId).length;

    return {
      total: tagAgg._count,
      withVideos,
      withGames,
      withImages,
      empty,
      uncategorized,
      categoryCount,
      aliasCount,
      implicationCount,
    };
  }),

  createTag: adminProcedure
    .use(requireScope("tag:manage"))
    .input(
      z.object({
        name: z.string().min(1).max(50),
        slug: z.string().min(1).max(50).optional(),
        categoryId: z.string().optional(),
        description: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug =
        input.slug ||
        input.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "");

      const existing = await ctx.prisma.tag.findFirst({
        where: { OR: [{ name: input.name }, { slug }] },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "标签名称或 slug 已存在" });

      const tag = await ctx.prisma.tag.create({
        data: {
          name: input.name,
          slug,
          categoryId: input.categoryId || null,
          description: input.description || null,
        },
      });
      await deleteCachePattern("tag:*");

      return { success: true, tag };
    }),

  listTags: adminProcedure
    .use(requireScope("tag:manage"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        categoryId: z.string().optional(),
        uncategorized: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, page } = input;
      const conditions: Prisma.TagWhereInput[] = [];

      if (input.search) {
        conditions.push({
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
            { aliases: { some: { name: { contains: input.search, mode: "insensitive" } } } },
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
            aliases: { select: { id: true, name: true } },
            _count: { select: { impliedBy: true, implies: true } },
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
    .input(
      z.object({
        tagId: z.string(),
        name: z.string().min(1).max(50).optional(),
        slug: z.string().min(1).max(50).optional(),
        categoryId: z.string().nullable().optional(),
        description: z.string().max(200).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tagId, ...data } = input;
      const tag = await ctx.prisma.tag.update({ where: { id: tagId }, data });
      await deleteCachePattern("tag:*");

      return { success: true, tag };
    }),

  batchUpdateTagCategory: adminProcedure
    .use(requireScope("tag:manage"))
    .input(
      z.object({
        tagIds: z.array(z.string()).min(1).max(100),
        categoryId: z.string().nullable(),
      }),
    )
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
    .input(
      z.object({
        sourceTagIds: z.array(z.string()).min(1).max(100),
        targetTagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sourceTagIds = input.sourceTagIds.filter((id) => id !== input.targetTagId);
      if (sourceTagIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "源标签不能与目标标签相同" });
      }

      const targetTag = await ctx.prisma.tag.findUnique({ where: { id: input.targetTagId } });
      if (!targetTag) throw new TRPCError({ code: "NOT_FOUND", message: "目标标签不存在" });

      await ctx.prisma.$transaction(async (tx) => {
        // 迁移视频关联
        const sourceVideos = await tx.video.findMany({
          where: { tags: { some: { tagId: { in: sourceTagIds } } } },
          select: { id: true },
        });
        if (sourceVideos.length > 0) {
          await tx.tagOnVideo.createMany({
            data: sourceVideos.map((v) => ({ videoId: v.id, tagId: input.targetTagId })),
            skipDuplicates: true,
          });
          await tx.tagOnVideo.deleteMany({
            where: { tagId: { in: sourceTagIds } },
          });
        }

        // 迁移游戏关联
        const sourceGames = await tx.game.findMany({
          where: { tags: { some: { tagId: { in: sourceTagIds } } } },
          select: { id: true },
        });
        if (sourceGames.length > 0) {
          await tx.tagOnGame.createMany({
            data: sourceGames.map((g) => ({ gameId: g.id, tagId: input.targetTagId })),
            skipDuplicates: true,
          });
          await tx.tagOnGame.deleteMany({
            where: { tagId: { in: sourceTagIds } },
          });
        }

        // 迁移图片关联
        const sourceImagePosts = await tx.imagePost.findMany({
          where: { tags: { some: { tagId: { in: sourceTagIds } } } },
          select: { id: true },
        });
        if (sourceImagePosts.length > 0) {
          await tx.tagOnImagePost.createMany({
            data: sourceImagePosts.map((p) => ({ imagePostId: p.id, tagId: input.targetTagId })),
            skipDuplicates: true,
          });
          await tx.tagOnImagePost.deleteMany({
            where: { tagId: { in: sourceTagIds } },
          });
        }

        // 迁移别名到目标标签
        await tx.tagAlias.updateMany({
          where: { tagId: { in: sourceTagIds } },
          data: { tagId: input.targetTagId },
        });

        // 迁移蕴含关系：先收集、再删除、再去重重建，避免唯一约束冲突
        const sourceImplications = await tx.tagImplication.findMany({
          where: {
            OR: [{ sourceTagId: { in: sourceTagIds } }, { targetTagId: { in: sourceTagIds } }],
          },
        });

        await tx.tagImplication.deleteMany({
          where: {
            OR: [{ sourceTagId: { in: sourceTagIds } }, { targetTagId: { in: sourceTagIds } }],
          },
        });

        const allSourceIds = new Set(sourceTagIds);
        const newImplications: { sourceTagId: string; targetTagId: string }[] = [];
        const seen = new Set<string>();

        for (const impl of sourceImplications) {
          const newSource = allSourceIds.has(impl.sourceTagId) ? input.targetTagId : impl.sourceTagId;
          const newTarget = allSourceIds.has(impl.targetTagId) ? input.targetTagId : impl.targetTagId;
          if (newSource === newTarget) continue;
          const key = `${newSource}:${newTarget}`;
          if (seen.has(key)) continue;
          seen.add(key);
          newImplications.push({ sourceTagId: newSource, targetTagId: newTarget });
        }

        if (newImplications.length > 0) {
          await tx.tagImplication.createMany({
            data: newImplications,
            skipDuplicates: true,
          });
        }

        await tx.tag.deleteMany({ where: { id: { in: sourceTagIds } } });
      });

      const { refreshTagCounts } = await import("@/lib/tag-counts");
      await refreshTagCounts([input.targetTagId]);

      await deleteCachePattern("tag:*");

      return { success: true, mergedCount: sourceTagIds.length };
    }),

  // ========== 标签别名管理 ==========

  addAlias: adminProcedure
    .use(requireScope("tag:manage"))
    .input(
      z.object({
        tagId: z.string(),
        name: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.tagAlias.findUnique({ where: { name: input.name } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "该别名已存在" });

      const existingTag = await ctx.prisma.tag.findFirst({
        where: { name: input.name },
      });
      if (existingTag) throw new TRPCError({ code: "CONFLICT", message: "该名称已是一个标签的主名称" });

      const alias = await ctx.prisma.tagAlias.create({
        data: { tagId: input.tagId, name: input.name },
      });
      await deleteCachePattern("tag:*");
      return { success: true, alias };
    }),

  removeAlias: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ aliasId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tagAlias.delete({ where: { id: input.aliasId } });
      await deleteCachePattern("tag:*");
      return { success: true };
    }),

  listAliases: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ tagId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.tagAlias.findMany({
        where: { tagId: input.tagId },
        orderBy: { name: "asc" },
      });
    }),

  // ========== 标签蕴含关系管理 ==========

  addImplication: adminProcedure
    .use(requireScope("tag:manage"))
    .input(
      z.object({
        sourceTagId: z.string(),
        targetTagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sourceTagId === input.targetTagId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能蕴含自身" });
      }

      // 传递性环检测：从 targetTag 出发沿 implies 方向 BFS，如果能到达 sourceTag 则形成环
      const visited = new Set<string>([input.targetTagId]);
      const queue = [input.targetTagId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const outgoing = await ctx.prisma.tagImplication.findMany({
          where: { sourceTagId: current },
          select: { targetTagId: true },
        });
        for (const edge of outgoing) {
          if (edge.targetTagId === input.sourceTagId) {
            throw new TRPCError({ code: "CONFLICT", message: "添加此蕴含关系会形成循环" });
          }
          if (!visited.has(edge.targetTagId)) {
            visited.add(edge.targetTagId);
            queue.push(edge.targetTagId);
          }
        }
      }

      const impl = await ctx.prisma.tagImplication.create({ data: input });
      await deleteCachePattern("tag:*");
      return { success: true, implication: impl };
    }),

  removeImplication: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ implicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tagImplication.delete({ where: { id: input.implicationId } });
      await deleteCachePattern("tag:*");
      return { success: true };
    }),

  listImplications: adminProcedure
    .use(requireScope("tag:manage"))
    .input(z.object({ tagId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [implies, impliedBy] = await Promise.all([
        ctx.prisma.tagImplication.findMany({
          where: { sourceTagId: input.tagId },
          include: { targetTag: { select: { id: true, name: true, slug: true } } },
        }),
        ctx.prisma.tagImplication.findMany({
          where: { targetTagId: input.tagId },
          include: { sourceTag: { select: { id: true, name: true, slug: true } } },
        }),
      ]);
      return { implies, impliedBy };
    }),

  // ========== 全量重算标签计数 ==========

  refreshAllCounts: adminProcedure.use(requireScope("tag:manage")).mutation(async () => {
    const { refreshAllTagCounts } = await import("@/lib/tag-counts");
    const count = await refreshAllTagCounts();
    await deleteCachePattern("tag:*");
    return { success: true, tagCount: count };
  }),
});
