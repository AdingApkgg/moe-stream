import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { memGetOrSet } from "@/lib/memory-cache";
import { splitSearchTokens, suggestionTextRank } from "@/lib/search-text";
import { meili, INDEX } from "@/lib/meilisearch";
import { meiliQuoteFilterValue } from "@/lib/search-index-config";

const SEARCH_COUNTS_TTL_MS = 60_000;
const SEARCH_ALL_TTL_MS = 60_000;

const PUBLISHED = meiliQuoteFilterValue("PUBLISHED");

export const searchRouter = router({
  /** 各内容类型命中数量（用于搜索页 Tab Badge），短时内存缓存 */
  counts: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
      }),
    )
    .query(async ({ input }) => {
      const raw = input.query.trim();
      const tokens = splitSearchTokens(raw);
      if (tokens.length === 0) {
        return { video: 0, game: 0, image: 0, tag: 0 };
      }

      const key = `search:counts:${raw.toLowerCase()}`;

      return memGetOrSet(
        key,
        async () => {
          const [v, g, i, t] = await Promise.all([
            meili.index(INDEX.video).search(raw, {
              limit: 0,
              filter: `status = ${PUBLISHED}`,
              attributesToRetrieve: [],
            }),
            meili.index(INDEX.game).search(raw, {
              limit: 0,
              filter: `status = ${PUBLISHED}`,
              attributesToRetrieve: [],
            }),
            meili.index(INDEX.image).search(raw, {
              limit: 0,
              filter: `status = ${PUBLISHED}`,
              attributesToRetrieve: [],
            }),
            meili.index(INDEX.tag).search(raw, {
              limit: 0,
              attributesToRetrieve: [],
            }),
          ]);

          return {
            video: v.estimatedTotalHits ?? v.hits.length,
            game: g.estimatedTotalHits ?? g.hits.length,
            image: i.estimatedTotalHits ?? i.hits.length,
            tag: t.estimatedTotalHits ?? t.hits.length,
          };
        },
        SEARCH_COUNTS_TTL_MS,
      );
    }),

  /**
   * 综合搜索：按相关性排序的各类型 Top N，用于「综合」Tab。
   * 类似 B 站：分区呈现 用户 / 标签 / 视频 / 游戏 / 图帖，每段返回少量精选 + 总数。
   */
  all: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        videoLimit: z.number().min(1).max(12).default(4),
        gameLimit: z.number().min(1).max(12).default(4),
        imageLimit: z.number().min(1).max(12).default(4),
        tagLimit: z.number().min(1).max(20).default(10),
        userLimit: z.number().min(1).max(12).default(6),
      }),
    )
    .query(async ({ ctx, input }) => {
      const raw = input.query.trim();
      const tokens = splitSearchTokens(raw);
      if (tokens.length === 0) {
        return {
          videos: { items: [], totalCount: 0 },
          games: { items: [], totalCount: 0 },
          imagePosts: { items: [], totalCount: 0 },
          tags: { items: [], totalCount: 0 },
          users: { items: [], totalCount: 0 },
        };
      }

      const cacheKey =
        `search:all:${raw.toLowerCase()}:` +
        `${input.videoLimit}:${input.gameLimit}:${input.imageLimit}:${input.tagLimit}:${input.userLimit}`;

      return memGetOrSet(
        cacheKey,
        async () => {
          const cap = (n: number) => Math.min(n * 4, 30);

          const [vRes, gRes, iRes, tRes, uRes] = await Promise.all([
            meili.index(INDEX.video).search(raw, {
              limit: cap(input.videoLimit),
              filter: `status = ${PUBLISHED}`,
              attributesToRetrieve: ["id"],
            }),
            meili.index(INDEX.game).search(raw, {
              limit: cap(input.gameLimit),
              filter: `status = ${PUBLISHED}`,
              attributesToRetrieve: ["id"],
            }),
            meili.index(INDEX.image).search(raw, {
              limit: cap(input.imageLimit),
              filter: `status = ${PUBLISHED}`,
              attributesToRetrieve: ["id"],
            }),
            meili.index(INDEX.tag).search(raw, {
              limit: cap(input.tagLimit),
              attributesToRetrieve: ["id"],
            }),
            meili.index(INDEX.user).search(raw, {
              limit: cap(input.userLimit),
              filter: `isBanned = false`,
              attributesToRetrieve: ["id"],
            }),
          ]);

          const vIds = vRes.hits.map((h: Record<string, unknown>) => String(h.id));
          const gIds = gRes.hits.map((h: Record<string, unknown>) => String(h.id));
          const iIds = iRes.hits.map((h: Record<string, unknown>) => String(h.id));
          const tIds = tRes.hits.map((h: Record<string, unknown>) => String(h.id));
          const uIds = uRes.hits.map((h: Record<string, unknown>) => String(h.id));

          const [videoItems, gameItems, imageItems, tagItems, userItems] = await Promise.all([
            vIds.length
              ? ctx.prisma.video.findMany({
                  where: { id: { in: vIds }, status: "PUBLISHED" },
                  include: {
                    uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
                    tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
                    _count: {
                      select: { likes: true, dislikes: true, confused: true, comments: true, favorites: true },
                    },
                  },
                })
              : [],
            gIds.length
              ? ctx.prisma.game.findMany({
                  where: { id: { in: gIds }, status: "PUBLISHED" },
                  include: {
                    uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
                    tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
                    _count: { select: { likes: true, dislikes: true, favorites: true } },
                  },
                })
              : [],
            iIds.length
              ? ctx.prisma.imagePost.findMany({
                  where: { id: { in: iIds }, status: "PUBLISHED" },
                  include: {
                    uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
                    tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
                  },
                })
              : [],
            tIds.length
              ? ctx.prisma.tag.findMany({
                  where: { id: { in: tIds } },
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    videoCount: true,
                    gameCount: true,
                    imagePostCount: true,
                  },
                })
              : [],
            uIds.length
              ? ctx.prisma.user.findMany({
                  where: { id: { in: uIds }, isBanned: false },
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                    avatar: true,
                    bio: true,
                    _count: { select: { videos: true } },
                  },
                })
              : [],
          ]);

          const orderByIds = <T extends { id: string }>(rows: T[], ids: string[]): T[] => {
            const m = new Map(rows.map((r) => [r.id, r]));
            return ids.map((id) => m.get(id)).filter((x): x is T => Boolean(x));
          };

          const videoOrdered = orderByIds(videoItems, vIds);
          const gameOrdered = orderByIds(gameItems, gIds);
          const imageOrdered = orderByIds(imageItems, iIds);
          const tagOrdered = orderByIds(tagItems, tIds);
          const userOrdered = orderByIds(userItems, uIds);

          const scoreContent = (title: string, views: number) =>
            suggestionTextRank(title, raw) * 100_000 + Math.min(views, 999_999);

          const sortedVideos = [...videoOrdered]
            .sort((a, b) => scoreContent(b.title, b.views) - scoreContent(a.title, a.views))
            .slice(0, input.videoLimit);
          const sortedGames = [...gameOrdered]
            .sort((a, b) => scoreContent(b.title, b.views) - scoreContent(a.title, a.views))
            .slice(0, input.gameLimit);
          const sortedImages = [...imageOrdered]
            .sort((a, b) => scoreContent(b.title, b.views) - scoreContent(a.title, a.views))
            .slice(0, input.imageLimit);

          const sortedTags = [...tagOrdered]
            .sort(
              (a, b) =>
                suggestionTextRank(b.name, raw) * 50_000 +
                (b.videoCount + b.gameCount + b.imagePostCount) -
                (suggestionTextRank(a.name, raw) * 50_000 + (a.videoCount + a.gameCount + a.imagePostCount)),
            )
            .slice(0, input.tagLimit);

          const userScore = (u: { username: string; nickname: string | null; _count: { videos: number } }) =>
            Math.max(suggestionTextRank(u.nickname ?? "", raw), suggestionTextRank(u.username, raw)) * 1000 +
            u._count.videos;

          const sortedUsers = [...userOrdered].sort((a, b) => userScore(b) - userScore(a)).slice(0, input.userLimit);

          return {
            videos: {
              items: sortedVideos,
              totalCount: vRes.estimatedTotalHits ?? vRes.hits.length,
            },
            games: {
              items: sortedGames,
              totalCount: gRes.estimatedTotalHits ?? gRes.hits.length,
            },
            imagePosts: {
              items: sortedImages,
              totalCount: iRes.estimatedTotalHits ?? iRes.hits.length,
            },
            tags: {
              items: sortedTags,
              totalCount: tRes.estimatedTotalHits ?? tRes.hits.length,
            },
            users: {
              items: sortedUsers,
              totalCount: uRes.estimatedTotalHits ?? uRes.hits.length,
            },
          };
        },
        SEARCH_ALL_TTL_MS,
      );
    }),
});
