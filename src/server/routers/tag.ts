import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, publicProcedure, adminProcedure } from "../trpc";
import { memGetOrSet, memDeletePrefix } from "@/lib/memory-cache";
import { mergeTagSearchIntoWhere } from "@/lib/search";

const tagTypeSchema = z.enum(["video", "game", "image"]).optional();

const CACHE_KEYS = {
  tagBySlug: (slug: string, type?: string) => `tag:slug:${slug}:${type || "all"}`,
  tagList: (categoryId: string, limit: number, type?: string) =>
    `tag:list:${categoryId || "all"}:${limit}:${type || "all"}`,
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

/** 按内容类型生成过滤条件和排序字段 */
function tagQueryHelpers(type?: "video" | "game" | "image") {
  const countField = {
    video: "videoCount",
    game: "gameCount",
    image: "imagePostCount",
  } as const;

  if (type && type in countField) {
    const field = countField[type];
    return {
      hasContent: { [field]: { gt: 0 } } satisfies Prisma.TagWhereInput,
      orderByCount: { [field]: "desc" as const },
    };
  }
  return {
    hasContent: {} satisfies Prisma.TagWhereInput,
    orderByCount: { name: "asc" as const },
  };
}

/** 标签公共 select（带预计算 count，不再需要 _count 子查询） */
const tagSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  categoryId: true,
  videoCount: true,
  gameCount: true,
  imagePostCount: true,
  createdAt: true,
  category: true,
} satisfies Prisma.TagSelect;

export const tagRouter = router({
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), type: z.enum(["video", "game", "image"]).default("video") }))
    .query(async ({ ctx, input }) => {
      return memGetOrSet(
        CACHE_KEYS.tagBySlug(input.slug, input.type),
        async () => {
          return ctx.prisma.tag.findUnique({
            where: { slug: input.slug },
            select: {
              ...tagSelect,
              aliases: { select: { id: true, name: true } },
            },
          });
        },
        CACHE_TTL.tag * 1000,
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

      if (input.search) {
        const tagWhere = mergeTagSearchIntoWhere(
          {
            ...h.hasContent,
            ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          },
          input.search,
        );
        return ctx.prisma.tag.findMany({
          take: input.limit,
          where: tagWhere,
          select: tagSelect,
          orderBy: { name: "asc" },
        });
      }

      const where: Prisma.TagWhereInput = {
        ...h.hasContent,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      };

      return memGetOrSet(
        CACHE_KEYS.tagList(input.categoryId || "", input.limit, input.type),
        async () => {
          return ctx.prisma.tag.findMany({
            take: input.limit,
            where,
            select: tagSelect,
            orderBy: { name: "asc" },
          });
        },
        CACHE_TTL.list * 1000,
      );
    }),

  popular: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
        type: z.enum(["video", "game", "image"]).default("video"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const h = tagQueryHelpers(input.type);
      return memGetOrSet(
        CACHE_KEYS.popularTags(input.limit, input.type),
        async () => {
          return ctx.prisma.tag.findMany({
            take: input.limit,
            where: h.hasContent,
            select: tagSelect,
            orderBy: h.orderByCount,
          });
        },
        CACHE_TTL.popular * 1000,
      );
    }),

  categories: publicProcedure.query(async ({ ctx }) => {
    return memGetOrSet(
      CACHE_KEYS.categories,
      async () => {
        return ctx.prisma.tagCategory.findMany({
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            type: true,
            sortOrder: true,
            _count: { select: { tags: true } },
          },
        });
      },
      CACHE_TTL.categories * 1000,
    );
  }),

  groupedByCategory: publicProcedure.input(z.object({ type: tagTypeSchema })).query(async ({ ctx, input }) => {
    const h = tagQueryHelpers(input.type);

    return memGetOrSet(
      CACHE_KEYS.tagsByCategory(input.type),
      async () => {
        const [categories, tags] = await Promise.all([
          ctx.prisma.tagCategory.findMany({
            orderBy: { sortOrder: "asc" },
          }),
          ctx.prisma.tag.findMany({
            where: h.hasContent,
            select: tagSelect,
            orderBy: { name: "asc" },
          }),
        ]);

        const grouped: {
          category: { id: string; name: string; slug: string; color: string; type: string } | null;
          tags: typeof tags;
        }[] = [];

        for (const cat of categories) {
          const catTags = tags.filter((t) => t.categoryId === cat.id);
          if (catTags.length > 0) {
            grouped.push({
              category: { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, type: cat.type },
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
      CACHE_TTL.categories * 1000,
    );
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(30),
        slug: z.string().min(1).max(30),
        categoryId: z.string().optional(),
        description: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.prisma.tag.create({
        data: {
          name: input.name,
          slug: input.slug,
          categoryId: input.categoryId || null,
          description: input.description || null,
        },
      });

      memDeletePrefix("tag:");

      return tag;
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.tag.delete({
      where: { id: input.id },
    });

    memDeletePrefix("tag:");

    return { success: true };
  }),
});
