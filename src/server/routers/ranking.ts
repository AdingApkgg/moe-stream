import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getRanking } from "@/lib/ranking/cache";
import type { RankingCategory, RankingContentType, RankingPeriod } from "@/lib/ranking/types";

const listContentTypeSchema = z.enum(["video", "image", "game", "combined"]);
const baseCategorySchema = z.enum(["score", "surge", "fav_period", "fav_total"]);
const periodSchema = z.enum(["1d", "7d", "30d", "all"]);
const tagCategorySchema = z.enum(["tag_hot", "tag_surge"]);

/** 按 category 推导真实使用的 period，前端可以传任意但 server 会归一 */
function resolvePeriod(category: RankingCategory, period: RankingPeriod): RankingPeriod {
  if (category === "surge") return "1d";
  if (category === "fav_total") return "all";
  if (category === "tag_hot") return "all";
  if (category === "tag_surge") return "1d";
  return period;
}

const VIDEO_INCLUDE = {
  uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { likes: true, dislikes: true, favorites: true, comments: true } },
} as const;

const IMAGE_INCLUDE = {
  uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { likes: true, dislikes: true, favorites: true, comments: true } },
} as const;

const GAME_INCLUDE = {
  uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { likes: true, dislikes: true, favorites: true, comments: true } },
} as const;

export const rankingRouter = router({
  /** 视频/图集/游戏/综合榜 */
  list: publicProcedure
    .input(
      z.object({
        contentType: listContentTypeSchema,
        category: baseCategorySchema,
        period: periodSchema,
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        excludeNsfw: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const period = resolvePeriod(input.category as RankingCategory, input.period as RankingPeriod);
      const ranked = await getRanking(
        input.contentType as RankingContentType,
        input.category as RankingCategory,
        period,
        input.limit,
        input.offset,
      );
      if (ranked.length === 0) return { items: [], hasMore: false };

      if (input.contentType === "video") {
        const ids = ranked.map((r) => r.id);
        const videos = await ctx.prisma.video.findMany({
          where: { id: { in: ids }, status: "PUBLISHED", ...(input.excludeNsfw ? { isNsfw: false } : {}) },
          include: VIDEO_INCLUDE,
        });
        const byId = new Map(videos.map((v) => [v.id, v] as const));
        const items = ranked
          .map((r) => {
            const v = byId.get(r.id);
            return v ? { type: "video" as const, score: r.score, rank: r.rank, video: v } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        return { items, hasMore: ranked.length === input.limit };
      }

      if (input.contentType === "image") {
        const ids = ranked.map((r) => r.id);
        const imagePosts = await ctx.prisma.imagePost.findMany({
          where: { id: { in: ids }, status: "PUBLISHED", ...(input.excludeNsfw ? { isNsfw: false } : {}) },
          include: IMAGE_INCLUDE,
        });
        const byId = new Map(imagePosts.map((v) => [v.id, v] as const));
        const items = ranked
          .map((r) => {
            const v = byId.get(r.id);
            return v ? { type: "image" as const, score: r.score, rank: r.rank, imagePost: v } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        return { items, hasMore: ranked.length === input.limit };
      }

      if (input.contentType === "game") {
        const ids = ranked.map((r) => r.id);
        const games = await ctx.prisma.game.findMany({
          where: { id: { in: ids }, status: "PUBLISHED", ...(input.excludeNsfw ? { isNsfw: false } : {}) },
          include: GAME_INCLUDE,
        });
        const byId = new Map(games.map((v) => [v.id, v] as const));
        const items = ranked
          .map((r) => {
            const v = byId.get(r.id);
            return v ? { type: "game" as const, score: r.score, rank: r.rank, game: v } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        return { items, hasMore: ranked.length === input.limit };
      }

      // combined：ranked.id 形如 "video:xxx" / "image:xxx" / "game:xxx"
      const buckets: Record<"video" | "image" | "game", string[]> = { video: [], image: [], game: [] };
      const order: Array<{ type: "video" | "image" | "game"; rawId: string; score: number; rank: number }> = [];
      for (const r of ranked) {
        const [t, ...rest] = r.id.split(":");
        if (t !== "video" && t !== "image" && t !== "game") continue;
        const rawId = rest.join(":");
        buckets[t].push(rawId);
        order.push({ type: t, rawId, score: r.score, rank: r.rank });
      }
      const [videos, imagePosts, games] = await Promise.all([
        buckets.video.length > 0
          ? ctx.prisma.video.findMany({
              where: {
                id: { in: buckets.video },
                status: "PUBLISHED",
                ...(input.excludeNsfw ? { isNsfw: false } : {}),
              },
              include: VIDEO_INCLUDE,
            })
          : [],
        buckets.image.length > 0
          ? ctx.prisma.imagePost.findMany({
              where: {
                id: { in: buckets.image },
                status: "PUBLISHED",
                ...(input.excludeNsfw ? { isNsfw: false } : {}),
              },
              include: IMAGE_INCLUDE,
            })
          : [],
        buckets.game.length > 0
          ? ctx.prisma.game.findMany({
              where: { id: { in: buckets.game }, status: "PUBLISHED", ...(input.excludeNsfw ? { isNsfw: false } : {}) },
              include: GAME_INCLUDE,
            })
          : [],
      ]);
      const vById = new Map(videos.map((v) => [v.id, v] as const));
      const iById = new Map(imagePosts.map((v) => [v.id, v] as const));
      const gById = new Map(games.map((v) => [v.id, v] as const));
      const items = order
        .map((o) => {
          if (o.type === "video") {
            const v = vById.get(o.rawId);
            return v ? { type: "video" as const, score: o.score, rank: o.rank, video: v } : null;
          }
          if (o.type === "image") {
            const v = iById.get(o.rawId);
            return v ? { type: "image" as const, score: o.score, rank: o.rank, imagePost: v } : null;
          }
          const v = gById.get(o.rawId);
          return v ? { type: "game" as const, score: o.score, rank: o.rank, game: v } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { items, hasMore: ranked.length === input.limit };
    }),

  /** 标签榜 */
  tags: publicProcedure
    .input(
      z.object({
        category: tagCategorySchema,
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const period: RankingPeriod = input.category === "tag_hot" ? "all" : "1d";
      const ranked = await getRanking("tag", input.category, period, input.limit, input.offset);
      if (ranked.length === 0) return { items: [], hasMore: false };

      const ids = ranked.map((r) => r.id);
      const tags = await ctx.prisma.tag.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          videoCount: true,
          gameCount: true,
          imagePostCount: true,
          category: { select: { id: true, name: true } },
        },
      });
      const byId = new Map(tags.map((t) => [t.id, t] as const));
      const items = ranked
        .map((r) => {
          const t = byId.get(r.id);
          return t ? { ...t, score: r.score, rank: r.rank } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { items, hasMore: ranked.length === input.limit };
    }),
});
