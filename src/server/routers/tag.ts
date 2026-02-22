import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, publicProcedure, adminProcedure } from "../trpc";
import { getOrSet, deleteCachePattern } from "@/lib/redis";

const tagTypeSchema = z.enum(["video", "game"]).optional();

const CACHE_KEYS = {
  tagBySlug: (slug: string, type?: string) => `tag:slug:${slug}:${type || "all"}`,
  tagList: (search: string, limit: number, type?: string) =>
    `tag:list:${search || "all"}:${limit}:${type || "all"}`,
  popularTags: (limit: number, type?: string) => `tag:popular:${limit}:${type || "all"}`,
  categories: "tag:categories",
  tagsByCategory: (type?: string) => `tag:by-category:${type || "all"}`,
};

const CACHE_TTL = {
  tag: 300,
  list: 300,
  popular: 600,
  categories: 600,
};

function tagQueryHelpers(type?: "video" | "game") {
  if (type === "game") {
    return {
      hasContent: { games: { some: {} } } satisfies Prisma.TagWhereInput,
      countSelect: { games: true } as const,
      orderByCount: { games: { _count: "desc" as const } },
    };
  }
  if (type === "video") {
    return {
      hasContent: { videos: { some: {} } } satisfies Prisma.TagWhereInput,
      countSelect: { videos: true } as const,
      orderByCount: { videos: { _count: "desc" as const } },
    };
  }
  return {
    hasContent: {} satisfies Prisma.TagWhereInput,
    countSelect: { videos: true, games: true } as const,
    orderByCount: { name: "asc" as const },
  };
}

export const tagRouter = router({
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), type: z.enum(["video", "game"]).default("video") }))
    .query(async ({ ctx, input }) => {
      const h = tagQueryHelpers(input.type);
      return getOrSet(
        CACHE_KEYS.tagBySlug(input.slug, input.type),
        async () => {
          return ctx.prisma.tag.findUnique({
            where: { slug: input.slug },
            include: {
              category: true,
              _count: { select: h.countSelect },
            },
          });
        },
        CACHE_TTL.tag,
      );
    }),

  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        type: tagTypeSchema,
        categoryId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const h = tagQueryHelpers(input.type);

      const where: Prisma.TagWhereInput = {
        ...h.hasContent,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.search
          ? { name: { contains: input.search, mode: "insensitive" } }
          : {}),
      };

      if (input.search) {
        return ctx.prisma.tag.findMany({
          take: input.limit,
          where,
          include: { category: true, _count: { select: h.countSelect } },
          orderBy: { name: "asc" },
        });
      }

      return getOrSet(
        CACHE_KEYS.tagList(input.categoryId || "", input.limit, input.type),
        async () => {
          return ctx.prisma.tag.findMany({
            take: input.limit,
            where,
            include: { category: true, _count: { select: h.countSelect } },
            orderBy: { name: "asc" },
          });
        },
        CACHE_TTL.list,
      );
    }),

  popular: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
        type: z.enum(["video", "game"]).default("video"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const h = tagQueryHelpers(input.type);
      return getOrSet(
        CACHE_KEYS.popularTags(input.limit, input.type),
        async () => {
          return ctx.prisma.tag.findMany({
            take: input.limit,
            where: h.hasContent,
            include: { category: true, _count: { select: h.countSelect } },
            orderBy: h.orderByCount,
          });
        },
        CACHE_TTL.popular,
      );
    }),

  // 获取所有标签分类
  categories: publicProcedure.query(async ({ ctx }) => {
    return getOrSet(
      CACHE_KEYS.categories,
      async () => {
        return ctx.prisma.tagCategory.findMany({
          orderBy: { sortOrder: "asc" },
          include: { _count: { select: { tags: true } } },
        });
      },
      CACHE_TTL.categories,
    );
  }),

  // 按分类分组获取所有标签（用于标签浏览页）
  groupedByCategory: publicProcedure
    .input(z.object({ type: tagTypeSchema }))
    .query(async ({ ctx, input }) => {
      const h = tagQueryHelpers(input.type);

      return getOrSet(
        CACHE_KEYS.tagsByCategory(input.type),
        async () => {
          const [categories, tags] = await Promise.all([
            ctx.prisma.tagCategory.findMany({
              orderBy: { sortOrder: "asc" },
            }),
            ctx.prisma.tag.findMany({
              where: h.hasContent,
              include: {
                category: true,
                _count: { select: h.countSelect },
              },
              orderBy: { name: "asc" },
            }),
          ]);

          const grouped: {
            category: { id: string; name: string; slug: string; color: string } | null;
            tags: typeof tags;
          }[] = [];

          for (const cat of categories) {
            const catTags = tags.filter((t) => t.categoryId === cat.id);
            if (catTags.length > 0) {
              grouped.push({
                category: { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color },
                tags: catTags,
              });
            }
          }

          const uncategorized = tags.filter((t) => !t.categoryId);
          if (uncategorized.length > 0) {
            grouped.push({ category: null, tags: uncategorized });
          }

          return grouped;
        },
        CACHE_TTL.categories,
      );
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(30),
        slug: z.string().min(1).max(30),
        categoryId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.prisma.tag.create({
        data: {
          name: input.name,
          slug: input.slug,
          categoryId: input.categoryId || null,
        },
      });

      await deleteCachePattern("tag:*");

      return tag;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tag.delete({
        where: { id: input.id },
      });

      await deleteCachePattern("tag:*");

      return { success: true };
    }),
});
