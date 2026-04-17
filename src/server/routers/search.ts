import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, publicProcedure } from "../trpc";
import { memGetOrSet } from "@/lib/memory-cache";
import { splitSearchTokens, suggestionTextRank } from "@/lib/search-text";
import { buildContentSearchWhere, buildGameSearchWhere, buildTagSearchWhere } from "@/lib/search";

const SEARCH_COUNTS_TTL_MS = 60_000;
const SEARCH_ALL_TTL_MS = 60_000;

export const searchRouter = router({
  /** 各内容类型命中数量（用于搜索页 Tab Badge），短时内存缓存 */
  counts: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const raw = input.query.trim();
      const tokens = splitSearchTokens(raw);
      if (tokens.length === 0) {
        return { video: 0, game: 0, image: 0, tag: 0 };
      }

      const key = `search:counts:${raw.toLowerCase()}`;

      return memGetOrSet(
        key,
        async () => {
          const videoClause = buildContentSearchWhere(raw) as Prisma.VideoWhereInput | undefined;
          const gameClause = buildGameSearchWhere(raw);
          const imageClause = buildContentSearchWhere(raw) as Prisma.ImagePostWhereInput | undefined;
          const tagClause = buildTagSearchWhere(raw);

          const [video, game, image, tag] = await Promise.all([
            ctx.prisma.video.count({
              where: {
                status: "PUBLISHED",
                ...(videoClause ? { AND: [videoClause] } : {}),
              },
            }),
            ctx.prisma.game.count({
              where: {
                status: "PUBLISHED",
                ...(gameClause ? { AND: [gameClause] } : {}),
              },
            }),
            ctx.prisma.imagePost.count({
              where: {
                status: "PUBLISHED",
                ...(imageClause ? { AND: [imageClause] } : {}),
              },
            }),
            ctx.prisma.tag.count({
              where: tagClause ?? {},
            }),
          ]);

          return { video, game, image, tag };
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
          const insensitive = Prisma.QueryMode.insensitive;

          const videoWhere: Prisma.VideoWhereInput = { status: "PUBLISHED" };
          const videoSearch = buildContentSearchWhere(raw) as Prisma.VideoWhereInput | undefined;
          if (videoSearch) videoWhere.AND = [videoSearch];

          const gameWhere: Prisma.GameWhereInput = { status: "PUBLISHED" };
          const gameSearch = buildGameSearchWhere(raw);
          if (gameSearch) gameWhere.AND = [gameSearch];

          const imageWhere: Prisma.ImagePostWhereInput = { status: "PUBLISHED" };
          const imageSearch = buildContentSearchWhere(raw) as Prisma.ImagePostWhereInput | undefined;
          if (imageSearch) imageWhere.AND = [imageSearch];

          const tagWhere = buildTagSearchWhere(raw) ?? {};

          const userWhere: Prisma.UserWhereInput = {
            isBanned: false,
            OR: [
              { username: { contains: raw, mode: insensitive } },
              { nickname: { contains: raw, mode: insensitive } },
            ],
          };

          // 候选集略大于返回上限，便于在内存中按相关性二次排序
          const cap = (n: number) => Math.min(n * 4, 30);

          const [
            videoItems,
            videoTotal,
            gameItems,
            gameTotal,
            imageItems,
            imageTotal,
            tagItems,
            tagTotal,
            userItems,
            userTotal,
          ] = await Promise.all([
            ctx.prisma.video.findMany({
              where: videoWhere,
              take: cap(input.videoLimit),
              orderBy: { views: "desc" },
              include: {
                uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
                tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
                _count: {
                  select: { likes: true, dislikes: true, confused: true, comments: true, favorites: true },
                },
              },
            }),
            ctx.prisma.video.count({ where: videoWhere }),
            ctx.prisma.game.findMany({
              where: gameWhere,
              take: cap(input.gameLimit),
              orderBy: { views: "desc" },
              include: {
                uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
                tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
                _count: { select: { likes: true, dislikes: true, favorites: true } },
              },
            }),
            ctx.prisma.game.count({ where: gameWhere }),
            ctx.prisma.imagePost.findMany({
              where: imageWhere,
              take: cap(input.imageLimit),
              orderBy: { views: "desc" },
              include: {
                uploader: { select: { id: true, username: true, nickname: true, avatar: true } },
                tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
              },
            }),
            ctx.prisma.imagePost.count({ where: imageWhere }),
            ctx.prisma.tag.findMany({
              where: tagWhere,
              take: cap(input.tagLimit),
              select: {
                id: true,
                name: true,
                slug: true,
                videoCount: true,
                gameCount: true,
                imagePostCount: true,
              },
              orderBy: { videos: { _count: "desc" } },
            }),
            ctx.prisma.tag.count({ where: tagWhere }),
            ctx.prisma.user.findMany({
              where: userWhere,
              take: cap(input.userLimit),
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
                bio: true,
                _count: { select: { videos: true } },
              },
              orderBy: { createdAt: "desc" },
            }),
            ctx.prisma.user.count({ where: userWhere }),
          ]);

          // 相关性二次排序：标题精确/前缀命中优先，再按热度
          const scoreContent = (title: string, views: number) =>
            suggestionTextRank(title, raw) * 100_000 + Math.min(views, 999_999);

          const sortedVideos = [...videoItems]
            .sort((a, b) => scoreContent(b.title, b.views) - scoreContent(a.title, a.views))
            .slice(0, input.videoLimit);
          const sortedGames = [...gameItems]
            .sort((a, b) => scoreContent(b.title, b.views) - scoreContent(a.title, a.views))
            .slice(0, input.gameLimit);
          const sortedImages = [...imageItems]
            .sort((a, b) => scoreContent(b.title, b.views) - scoreContent(a.title, a.views))
            .slice(0, input.imageLimit);

          const sortedTags = [...tagItems]
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

          const sortedUsers = [...userItems].sort((a, b) => userScore(b) - userScore(a)).slice(0, input.userLimit);

          return {
            videos: { items: sortedVideos, totalCount: videoTotal },
            games: { items: sortedGames, totalCount: gameTotal },
            imagePosts: { items: sortedImages, totalCount: imageTotal },
            tags: { items: sortedTags, totalCount: tagTotal },
            users: { items: sortedUsers, totalCount: userTotal },
          };
        },
        SEARCH_ALL_TTL_MS,
      );
    }),
});
