import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, apiScopedProcedure, publicProcedure } from "../trpc";

const MAX_RANGE_DAYS = 90;
const DAY_MS = 1000 * 60 * 60 * 24;

function computeDayCount(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1;
}

const dateRangeInput = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine((d) => new Date(d.to) >= new Date(d.from), { message: "结束日期不能早于开始日期" })
  .refine(
    (d) => {
      const days = computeDayCount(new Date(d.from), new Date(d.to));
      return days >= 1 && days <= MAX_RANGE_DAYS;
    },
    { message: `日期范围不能超过 ${MAX_RANGE_DAYS} 天` },
  );

const statsProcedure = apiScopedProcedure("stats:read");
const systemProcedure = apiScopedProcedure("system:read");
const referralProcedure = apiScopedProcedure("referral:read");
const paymentProcedure = apiScopedProcedure("payment:read");
const contentProcedure = apiScopedProcedure("content:read");

export const openApiRouter = router({
  // ==================== 数据统计 (stats:read) ====================

  /** 站点数据总览：全站关键指标一览 */
  overview: statsProcedure.query(async ({ ctx }) => {
    const [
      userCount,
      videoCount,
      gameCount,
      imagePostCount,
      tagCount,
      seriesCount,
      searchCount,
      videoViews,
      gameViews,
      imageViews,
      videoLikes,
      videoDislikes,
      videoFavorites,
      videoComments,
      gameLikes,
      gameDislikes,
      gameFavorites,
      gameComments,
      imagePostLikes,
      imagePostDislikes,
      imagePostFavorites,
      imagePostComments,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.video.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.game.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.imagePost.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.tag.count(),
      ctx.prisma.series.count(),
      ctx.prisma.searchRecord.count(),
      ctx.prisma.video.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
      ctx.prisma.game.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
      ctx.prisma.imagePost.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
      ctx.prisma.like.count(),
      ctx.prisma.dislike.count(),
      ctx.prisma.favorite.count(),
      ctx.prisma.comment.count({ where: { isDeleted: false } }),
      ctx.prisma.gameLike.count(),
      ctx.prisma.gameDislike.count(),
      ctx.prisma.gameFavorite.count(),
      ctx.prisma.gameComment.count({ where: { isDeleted: false } }),
      ctx.prisma.imagePostLike.count(),
      ctx.prisma.imagePostDislike.count(),
      ctx.prisma.imagePostFavorite.count(),
      ctx.prisma.imagePostComment.count({ where: { isDeleted: false } }),
    ]);

    return {
      counts: {
        users: userCount,
        videos: videoCount,
        games: gameCount,
        imagePosts: imagePostCount,
        tags: tagCount,
        series: seriesCount,
        searches: searchCount,
      },
      views: {
        total: (videoViews._sum.views || 0) + (gameViews._sum.views || 0) + (imageViews._sum.views || 0),
        video: videoViews._sum.views || 0,
        game: gameViews._sum.views || 0,
        image: imageViews._sum.views || 0,
      },
      interactions: {
        likes: {
          total: videoLikes + gameLikes + imagePostLikes,
          video: videoLikes,
          game: gameLikes,
          image: imagePostLikes,
        },
        dislikes: {
          total: videoDislikes + gameDislikes + imagePostDislikes,
          video: videoDislikes,
          game: gameDislikes,
          image: imagePostDislikes,
        },
        favorites: {
          total: videoFavorites + gameFavorites + imagePostFavorites,
          video: videoFavorites,
          game: gameFavorites,
          image: imagePostFavorites,
        },
        comments: {
          total: videoComments + gameComments + imagePostComments,
          video: videoComments,
          game: gameComments,
          image: imagePostComments,
        },
      },
    };
  }),

  /** 区间增长统计：指定日期范围内的新增数据 */
  growth: statsProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const dateRange = { gte: new Date(input.from), lte: new Date(input.to) };

    const [
      newUsers,
      newVideos,
      newGames,
      newImagePosts,
      newTags,
      newSeries,
      newSearches,
      newVideoComments,
      newGameComments,
      newImageComments,
      newVideoViews,
      newGameViews,
      newImageViews,
      newVideoLikes,
      newGameLikes,
      newImageLikes,
      newVideoFavorites,
      newGameFavorites,
      newImageFavorites,
    ] = await Promise.all([
      ctx.prisma.user.count({ where: { createdAt: dateRange } }),
      ctx.prisma.video.count({ where: { createdAt: dateRange, status: "PUBLISHED" } }),
      ctx.prisma.game.count({ where: { createdAt: dateRange, status: "PUBLISHED" } }),
      ctx.prisma.imagePost.count({ where: { createdAt: dateRange, status: "PUBLISHED" } }),
      ctx.prisma.tag.count({ where: { createdAt: dateRange } }),
      ctx.prisma.series.count({ where: { createdAt: dateRange } }),
      ctx.prisma.searchRecord.count({ where: { createdAt: dateRange } }),
      ctx.prisma.comment.count({ where: { createdAt: dateRange, isDeleted: false } }),
      ctx.prisma.gameComment.count({ where: { createdAt: dateRange, isDeleted: false } }),
      ctx.prisma.imagePostComment.count({ where: { createdAt: dateRange, isDeleted: false } }),
      ctx.prisma.watchHistory.count({ where: { createdAt: dateRange } }),
      ctx.prisma.gameViewHistory.count({ where: { createdAt: dateRange } }),
      ctx.prisma.imagePostViewHistory.count({ where: { createdAt: dateRange } }),
      ctx.prisma.like.count({ where: { createdAt: dateRange } }),
      ctx.prisma.gameLike.count({ where: { createdAt: dateRange } }),
      ctx.prisma.imagePostLike.count({ where: { createdAt: dateRange } }),
      ctx.prisma.favorite.count({ where: { createdAt: dateRange } }),
      ctx.prisma.gameFavorite.count({ where: { createdAt: dateRange } }),
      ctx.prisma.imagePostFavorite.count({ where: { createdAt: dateRange } }),
    ]);

    return {
      period: { from: input.from, to: input.to },
      newUsers,
      newContent: {
        total: newVideos + newGames + newImagePosts,
        videos: newVideos,
        games: newGames,
        imagePosts: newImagePosts,
      },
      newTags,
      newSeries,
      newSearches,
      newComments: newVideoComments + newGameComments + newImageComments,
      newViews: newVideoViews + newGameViews + newImageViews,
      newLikes: newVideoLikes + newGameLikes + newImageLikes,
      newFavorites: newVideoFavorites + newGameFavorites + newImageFavorites,
    };
  }),

  /** 增长趋势：按日聚合的趋势序列 */
  growthTrend: statsProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const since = new Date(input.from);
    const until = new Date(input.to);

    type DailyCountRow = { day: string; count: number };

    const dailyCounts = (table: string, extraWhere = ""): Promise<DailyCountRow[]> => {
      const where = extraWhere
        ? `WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND ${extraWhere}`
        : `WHERE "createdAt" >= $1 AND "createdAt" <= $2`;
      return ctx.prisma.$queryRawUnsafe<DailyCountRow[]>(
        `SELECT to_char(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as day, COUNT(*)::int as count FROM "${table}" ${where} GROUP BY day`,
        since,
        until,
      );
    };

    const [
      users,
      videos,
      images,
      games,
      videoViews,
      gameViews,
      imageViews,
      videoLikes,
      gameLikes,
      imageLikes,
      videoFavs,
      gameFavs,
      imageFavs,
      videoComments,
      gameComments,
      imageComments,
    ] = await Promise.all([
      dailyCounts("User"),
      dailyCounts("Video", `"status" = 'PUBLISHED'`),
      dailyCounts("ImagePost", `"status" = 'PUBLISHED'`),
      dailyCounts("Game", `"status" = 'PUBLISHED'`),
      dailyCounts("WatchHistory"),
      dailyCounts("GameViewHistory"),
      dailyCounts("ImagePostViewHistory"),
      dailyCounts("Like"),
      dailyCounts("GameLike"),
      dailyCounts("ImagePostLike"),
      dailyCounts("Favorite"),
      dailyCounts("GameFavorite"),
      dailyCounts("ImagePostFavorite"),
      dailyCounts("Comment", `"isDeleted" = false`),
      dailyCounts("GameComment", `"isDeleted" = false`),
      dailyCounts("ImagePostComment", `"isDeleted" = false`),
    ]);

    type DayData = {
      users: number;
      videos: number;
      images: number;
      games: number;
      views: number;
      likes: number;
      favorites: number;
      comments: number;
    };
    const trend: Record<string, DayData> = {};
    const dayCount = computeDayCount(since, until);
    const toKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const empty = (): DayData => ({
      users: 0,
      videos: 0,
      images: 0,
      games: 0,
      views: 0,
      likes: 0,
      favorites: 0,
      comments: 0,
    });

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(since);
      date.setDate(date.getDate() + i);
      trend[toKey(date)] = empty();
    }

    const merge = (rows: DailyCountRow[], field: keyof DayData) => {
      for (const r of rows) if (trend[r.day]) trend[r.day][field] += r.count;
    };

    merge(users, "users");
    merge(videos, "videos");
    merge(images, "images");
    merge(games, "games");
    for (const rows of [videoViews, gameViews, imageViews]) merge(rows, "views");
    for (const rows of [videoLikes, gameLikes, imageLikes]) merge(rows, "likes");
    for (const rows of [videoFavs, gameFavs, imageFavs]) merge(rows, "favorites");
    for (const rows of [videoComments, gameComments, imageComments]) merge(rows, "comments");

    return Object.entries(trend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
  }),

  /** 内容排行榜 */
  leaderboard: statsProcedure
    .input(
      z.object({
        type: z.enum(["video", "game", "image"]),
        metric: z.enum(["views", "likes", "favorites", "comments"]),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { type, metric, limit } = input;

      if (type === "video") {
        const videos = await ctx.prisma.video.findMany({
          where: { status: "PUBLISHED" },
          orderBy:
            metric === "views"
              ? { views: "desc" }
              : metric === "likes"
                ? { likes: { _count: "desc" } }
                : metric === "favorites"
                  ? { favorites: { _count: "desc" } }
                  : { comments: { _count: "desc" } },
          take: limit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
            _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
          },
        });
        const items = videos;
        return {
          items: items.map((v) => ({
            id: v.id,
            title: v.title,
            coverUrl: v.coverUrl,
            createdAt: v.createdAt,
            value: metric === "views" ? v.views : v._count[metric],
            uploader: {
              id: v.uploader.id,
              name: v.uploader.nickname || v.uploader.username,
              avatar: v.uploader.avatar,
            },
            stats: {
              views: v.views,
              likes: v._count.likes,
              favorites: v._count.favorites,
              comments: v._count.comments,
            },
          })),
        };
      }

      if (type === "game") {
        const games = await ctx.prisma.game.findMany({
          where: { status: "PUBLISHED" },
          orderBy:
            metric === "views"
              ? { views: "desc" }
              : metric === "likes"
                ? { likes: { _count: "desc" } }
                : metric === "favorites"
                  ? { favorites: { _count: "desc" } }
                  : { comments: { _count: "desc" } },
          take: limit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
            _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
          },
        });
        const items = games;
        return {
          items: items.map((g) => ({
            id: g.id,
            title: g.title,
            coverUrl: g.coverUrl,
            createdAt: g.createdAt,
            value: metric === "views" ? g.views : g._count[metric],
            uploader: {
              id: g.uploader.id,
              name: g.uploader.nickname || g.uploader.username,
              avatar: g.uploader.avatar,
            },
            stats: {
              views: g.views,
              likes: g._count.likes,
              favorites: g._count.favorites,
              comments: g._count.comments,
            },
          })),
        };
      }

      // image
      const posts = await ctx.prisma.imagePost.findMany({
        where: { status: "PUBLISHED" },
        orderBy:
          metric === "views"
            ? { views: "desc" }
            : metric === "likes"
              ? { likes: { _count: "desc" } }
              : metric === "favorites"
                ? { favorites: { _count: "desc" } }
                : { comments: { _count: "desc" } },
        take: limit,
        select: {
          id: true,
          title: true,
          views: true,
          images: true,
          createdAt: true,
          uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
        },
      });
      const items = posts;
      return {
        items: items.map((p) => ({
          id: p.id,
          title: p.title,
          coverUrl: (p.images as string[])?.[0] ?? null,
          createdAt: p.createdAt,
          value: metric === "views" ? p.views : p._count[metric],
          uploader: { id: p.uploader.id, name: p.uploader.nickname || p.uploader.username, avatar: p.uploader.avatar },
          stats: { views: p.views, likes: p._count.likes, favorites: p._count.favorites, comments: p._count.comments },
        })),
      };
    }),

  /** 用户排行（上传量 / 积分 / 评论数 / 收藏数 / 点赞数） */
  userLeaderboard: statsProcedure
    .input(
      z.object({
        type: z.enum(["uploader", "points", "commentator", "collector", "liker"]),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { type, limit } = input;

      if (type === "points") {
        const users = await ctx.prisma.user.findMany({
          where: { isBanned: false, points: { gt: 0 } },
          orderBy: { points: "desc" },
          take: limit,
          select: { id: true, nickname: true, username: true, avatar: true, points: true, createdAt: true },
        });
        return {
          items: users.map((u) => ({
            userId: u.id,
            nickname: u.nickname || u.username,
            avatar: u.avatar,
            value: u.points,
            joinedAt: u.createdAt,
          })),
        };
      }

      // 各类型排行共用聚合逻辑
      const aggregateUserRanking = async (
        sources: { groupBy: () => Promise<{ userId: string | null; _count: number }[]> }[],
      ) => {
        const results = await Promise.all(sources.map((s) => s.groupBy()));
        const map = new Map<string, { video: number; game: number; image: number }>();
        results.forEach((rows, idx) => {
          const key = idx === 0 ? "video" : idx === 1 ? "game" : "image";
          for (const r of rows) {
            if (!r.userId) continue;
            const prev = map.get(r.userId) ?? { video: 0, game: 0, image: 0 };
            prev[key as "video" | "game" | "image"] = r._count;
            map.set(r.userId, prev);
          }
        });
        const sorted = [...map.entries()]
          .map(([userId, d]) => ({ userId, total: d.video + d.game + d.image, detail: d }))
          .sort((a, b) => b.total - a.total)
          .slice(0, limit);
        const userIds = sorted.map((s) => s.userId);
        const users = await ctx.prisma.user.findMany({
          where: { id: { in: userIds }, isBanned: false },
          select: { id: true, nickname: true, username: true, avatar: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));
        return {
          items: sorted
            .filter((s) => userMap.has(s.userId))
            .map((s) => {
              const u = userMap.get(s.userId)!;
              return {
                userId: u.id,
                nickname: u.nickname || u.username,
                avatar: u.avatar,
                value: s.total,
                detail: s.detail,
              };
            }),
        };
      };

      if (type === "uploader") {
        return aggregateUserRanking([
          {
            groupBy: async () => {
              const rows = await ctx.prisma.video.groupBy({
                by: ["uploaderId"],
                where: { status: "PUBLISHED" },
                _count: true,
              });
              return rows.map((r) => ({ userId: r.uploaderId, _count: r._count }));
            },
          },
          {
            groupBy: async () => {
              const rows = await ctx.prisma.game.groupBy({
                by: ["uploaderId"],
                where: { status: "PUBLISHED" },
                _count: true,
              });
              return rows.map((r) => ({ userId: r.uploaderId, _count: r._count }));
            },
          },
          {
            groupBy: async () => {
              const rows = await ctx.prisma.imagePost.groupBy({
                by: ["uploaderId"],
                where: { status: "PUBLISHED" },
                _count: true,
              });
              return rows.map((r) => ({ userId: r.uploaderId, _count: r._count }));
            },
          },
        ]);
      }

      if (type === "commentator") {
        return aggregateUserRanking([
          {
            groupBy: () =>
              ctx.prisma.comment.groupBy({
                by: ["userId"],
                where: { isDeleted: false, userId: { not: null } },
                _count: true,
              }) as never,
          },
          {
            groupBy: () =>
              ctx.prisma.gameComment.groupBy({
                by: ["userId"],
                where: { isDeleted: false, userId: { not: null } },
                _count: true,
              }) as never,
          },
          {
            groupBy: () =>
              ctx.prisma.imagePostComment.groupBy({
                by: ["userId"],
                where: { isDeleted: false, userId: { not: null } },
                _count: true,
              }) as never,
          },
        ]);
      }

      if (type === "collector") {
        return aggregateUserRanking([
          { groupBy: () => ctx.prisma.favorite.groupBy({ by: ["userId"], _count: true }) as never },
          { groupBy: () => ctx.prisma.gameFavorite.groupBy({ by: ["userId"], _count: true }) as never },
          { groupBy: () => ctx.prisma.imagePostFavorite.groupBy({ by: ["userId"], _count: true }) as never },
        ]);
      }

      // liker
      return aggregateUserRanking([
        { groupBy: () => ctx.prisma.like.groupBy({ by: ["userId"], _count: true }) as never },
        { groupBy: () => ctx.prisma.gameLike.groupBy({ by: ["userId"], _count: true }) as never },
        { groupBy: () => ctx.prisma.imagePostLike.groupBy({ by: ["userId"], _count: true }) as never },
      ]);
    }),

  /** 内容分布：各分区的内容数量及状态分布 */
  contentDistribution: statsProcedure.query(async ({ ctx }) => {
    const [
      videoPending,
      videoPublished,
      videoRejected,
      gamePending,
      gamePublished,
      gameRejected,
      imagePending,
      imagePublished,
      imageRejected,
    ] = await Promise.all([
      ctx.prisma.video.count({ where: { status: "PENDING" } }),
      ctx.prisma.video.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.video.count({ where: { status: "REJECTED" } }),
      ctx.prisma.game.count({ where: { status: "PENDING" } }),
      ctx.prisma.game.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.game.count({ where: { status: "REJECTED" } }),
      ctx.prisma.imagePost.count({ where: { status: "PENDING" } }),
      ctx.prisma.imagePost.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.imagePost.count({ where: { status: "REJECTED" } }),
    ]);

    return {
      video: {
        total: videoPending + videoPublished + videoRejected,
        pending: videoPending,
        published: videoPublished,
        rejected: videoRejected,
      },
      game: {
        total: gamePending + gamePublished + gameRejected,
        pending: gamePending,
        published: gamePublished,
        rejected: gameRejected,
      },
      image: {
        total: imagePending + imagePublished + imageRejected,
        pending: imagePending,
        published: imagePublished,
        rejected: imageRejected,
      },
    };
  }),

  /** 最近内容：按时间倒序的最新内容 */
  recentContent: statsProcedure
    .input(
      z.object({
        type: z.enum(["video", "game", "image", "all"]).default("all"),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { type, limit } = input;
      const result: {
        videos?: {
          id: string;
          title: string;
          coverUrl: string | null;
          views: number;
          createdAt: Date;
          uploader: { id: string; name: string };
        }[];
        games?: {
          id: string;
          title: string;
          coverUrl: string | null;
          views: number;
          createdAt: Date;
          uploader: { id: string; name: string };
        }[];
        images?: {
          id: string;
          title: string;
          coverUrl: string | null;
          views: number;
          createdAt: Date;
          uploader: { id: string; name: string };
        }[];
      } = {};

      if (type === "video" || type === "all") {
        const videos = await ctx.prisma.video.findMany({
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true } },
          },
        });
        result.videos = videos.map((v) => ({
          id: v.id,
          title: v.title,
          coverUrl: v.coverUrl,
          views: v.views,
          createdAt: v.createdAt,
          uploader: { id: v.uploader.id, name: v.uploader.nickname || v.uploader.username },
        }));
      }

      if (type === "game" || type === "all") {
        const games = await ctx.prisma.game.findMany({
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true } },
          },
        });
        result.games = games.map((g) => ({
          id: g.id,
          title: g.title,
          coverUrl: g.coverUrl,
          views: g.views,
          createdAt: g.createdAt,
          uploader: { id: g.uploader.id, name: g.uploader.nickname || g.uploader.username },
        }));
      }

      if (type === "image" || type === "all") {
        const posts = await ctx.prisma.imagePost.findMany({
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            images: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true } },
          },
        });
        result.images = posts.map((p) => ({
          id: p.id,
          title: p.title,
          coverUrl: (p.images as string[])?.[0] ?? null,
          views: p.views,
          createdAt: p.createdAt,
          uploader: { id: p.uploader.id, name: p.uploader.nickname || p.uploader.username },
        }));
      }

      return result;
    }),

  /** 用户注册统计 */
  userStats: statsProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * DAY_MS);
    const monthAgo = new Date(today.getTime() - 30 * DAY_MS);

    const [total, banned, canUpload, todayNew, weekNew, monthNew] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.count({ where: { isBanned: true } }),
      ctx.prisma.user.count({ where: { canUpload: true } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: today } } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);

    return {
      total,
      banned,
      canUpload,
      registration: { today: todayNew, last7Days: weekNew, last30Days: monthNew },
    };
  }),

  // ==================== 系统信息 (system:read) ====================

  /** 热门标签 */
  popularTags: systemProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
        sortBy: z.enum(["videoCount", "gameCount", "imagePostCount", "total"]).default("total"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, sortBy } = input;

      const tags = await ctx.prisma.tag.findMany({
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

      const withTotal = tags.map((t) => ({
        ...t,
        totalCount: t.videoCount + t.gameCount + t.imagePostCount,
      }));

      const sortKey = sortBy === "total" ? "totalCount" : sortBy;
      withTotal.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));

      return withTotal.slice(0, limit).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        category: t.category ? { id: t.category.id, name: t.category.name } : null,
        counts: { video: t.videoCount, game: t.gameCount, image: t.imagePostCount, total: t.totalCount },
      }));
    }),

  /** 合集列表 */
  seriesList: systemProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const series = await ctx.prisma.series.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          coverUrl: true,
          createdAt: true,
          creator: { select: { id: true, nickname: true, username: true, avatar: true } },
          _count: { select: { episodes: true } },
        },
      });

      const hasMore = series.length > limit;
      const items = hasMore ? series.slice(0, -1) : series;

      return {
        items: items.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          coverUrl: s.coverUrl,
          createdAt: s.createdAt,
          creator: { id: s.creator.id, name: s.creator.nickname || s.creator.username, avatar: s.creator.avatar },
          episodeCount: s._count.episodes,
        })),
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /** 存储用量摘要 */
  storageUsage: systemProcedure.query(async ({ ctx }) => {
    const policies = await ctx.prisma.storagePolicy.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        provider: true,
        maxFileSize: true,
        _count: { select: { files: true } },
      },
    });

    const [totalFiles, totalSize, completedFiles, uploadingFiles] = await Promise.all([
      ctx.prisma.userFile.count(),
      ctx.prisma.userFile.aggregate({ _sum: { size: true } }),
      ctx.prisma.userFile.count({ where: { status: "UPLOADED" } }),
      ctx.prisma.userFile.count({ where: { status: "UPLOADING" } }),
    ]);

    const policySizes = await Promise.all(
      policies.map(async (p) => {
        const agg = await ctx.prisma.userFile.aggregate({
          where: { storagePolicyId: p.id },
          _sum: { size: true },
          _count: true,
        });
        return {
          id: p.id,
          name: p.name,
          provider: p.provider,
          maxFileSize: Number(p.maxFileSize),
          fileCount: agg._count,
          totalSize: Number(agg._sum.size || 0),
        };
      }),
    );

    return {
      totalFiles,
      totalSize: Number(totalSize._sum.size || 0),
      completedFiles,
      uploadingFiles,
      policies: policySizes,
    };
  }),

  /** 搜索热词 */
  searchHotWords: systemProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.prisma.searchRecord.groupBy({
        by: ["keyword"],
        _count: true,
        orderBy: { _count: { keyword: "desc" } },
        take: input.limit,
      });

      return records.map((r) => ({ keyword: r.keyword, count: r._count }));
    }),

  /** 标签分类列表 */
  tagCategories: systemProcedure.query(async ({ ctx }) => {
    const categories = await ctx.prisma.tagCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
        _count: { select: { tags: true } },
      },
    });

    const uncategorized = await ctx.prisma.tag.count({ where: { categoryId: null } });

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        sortOrder: c.sortOrder,
        tagCount: c._count.tags,
      })),
      uncategorizedCount: uncategorized,
    };
  }),

  // ==================== 统一搜索 (content:read) ====================

  /** 跨内容类型统一搜索 */
  search: contentProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(100),
        types: z.array(z.enum(["video", "game", "image"])).optional(),
        sortBy: z.enum(["latest", "views"]).default("latest"),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { keyword, sortBy, page, limit } = input;
      const types = input.types ?? ["video", "game", "image"];
      const skip = (page - 1) * limit;
      const textFilter = { contains: keyword, mode: Prisma.QueryMode.insensitive };

      type SearchItem = {
        type: "video" | "game" | "image";
        id: string;
        title: string;
        coverUrl: string | null;
        views: number;
        createdAt: Date;
        uploader: { id: string; name: string; avatar: string | null };
      };

      const results: SearchItem[] = [];

      if (types.includes("video")) {
        const videos = await ctx.prisma.video.findMany({
          where: {
            status: "PUBLISHED",
            OR: [{ title: textFilter }, { description: textFilter }],
          },
          orderBy: sortBy === "views" ? { views: "desc" } : { createdAt: "desc" },
          take: limit,
          skip,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          },
        });
        for (const v of videos) {
          results.push({
            type: "video",
            id: v.id,
            title: v.title,
            coverUrl: v.coverUrl,
            views: v.views,
            createdAt: v.createdAt,
            uploader: {
              id: v.uploader.id,
              name: v.uploader.nickname || v.uploader.username,
              avatar: v.uploader.avatar,
            },
          });
        }
      }

      if (types.includes("game")) {
        const games = await ctx.prisma.game.findMany({
          where: {
            status: "PUBLISHED",
            OR: [{ title: textFilter }, { description: textFilter }],
          },
          orderBy: sortBy === "views" ? { views: "desc" } : { createdAt: "desc" },
          take: limit,
          skip,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          },
        });
        for (const g of games) {
          results.push({
            type: "game",
            id: g.id,
            title: g.title,
            coverUrl: g.coverUrl,
            views: g.views,
            createdAt: g.createdAt,
            uploader: {
              id: g.uploader.id,
              name: g.uploader.nickname || g.uploader.username,
              avatar: g.uploader.avatar,
            },
          });
        }
      }

      if (types.includes("image")) {
        const posts = await ctx.prisma.imagePost.findMany({
          where: {
            status: "PUBLISHED",
            OR: [{ title: textFilter }, { description: textFilter }],
          },
          orderBy: sortBy === "views" ? { views: "desc" } : { createdAt: "desc" },
          take: limit,
          skip,
          select: {
            id: true,
            title: true,
            images: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          },
        });
        for (const p of posts) {
          results.push({
            type: "image",
            id: p.id,
            title: p.title,
            coverUrl: (p.images as string[])?.[0] ?? null,
            views: p.views,
            createdAt: p.createdAt,
            uploader: {
              id: p.uploader.id,
              name: p.uploader.nickname || p.uploader.username,
              avatar: p.uploader.avatar,
            },
          });
        }
      }

      if (sortBy === "latest") {
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else {
        results.sort((a, b) => b.views - a.views);
      }

      return { items: results.slice(0, limit), page, limit };
    }),

  /** 混合内容时间线 */
  feed: contentProcedure
    .input(
      z.object({
        types: z.array(z.enum(["video", "game", "image"])).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const types = input.types ?? ["video", "game", "image"];
      const { cursor, limit } = input;
      const cursorDate = cursor ? new Date(cursor) : undefined;
      const dateWhere = cursorDate ? { createdAt: { lt: cursorDate } } : {};

      type FeedItem = {
        type: "video" | "game" | "image";
        id: string;
        title: string;
        coverUrl: string | null;
        views: number;
        createdAt: Date;
        uploader: { id: string; name: string; avatar: string | null };
      };

      const items: FeedItem[] = [];
      const perTypeLimit = limit + 1;

      if (types.includes("video")) {
        const videos = await ctx.prisma.video.findMany({
          where: { status: "PUBLISHED", ...dateWhere },
          orderBy: { createdAt: "desc" },
          take: perTypeLimit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          },
        });
        for (const v of videos) {
          items.push({
            type: "video",
            id: v.id,
            title: v.title,
            coverUrl: v.coverUrl,
            views: v.views,
            createdAt: v.createdAt,
            uploader: {
              id: v.uploader.id,
              name: v.uploader.nickname || v.uploader.username,
              avatar: v.uploader.avatar,
            },
          });
        }
      }

      if (types.includes("game")) {
        const games = await ctx.prisma.game.findMany({
          where: { status: "PUBLISHED", ...dateWhere },
          orderBy: { createdAt: "desc" },
          take: perTypeLimit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          },
        });
        for (const g of games) {
          items.push({
            type: "game",
            id: g.id,
            title: g.title,
            coverUrl: g.coverUrl,
            views: g.views,
            createdAt: g.createdAt,
            uploader: {
              id: g.uploader.id,
              name: g.uploader.nickname || g.uploader.username,
              avatar: g.uploader.avatar,
            },
          });
        }
      }

      if (types.includes("image")) {
        const posts = await ctx.prisma.imagePost.findMany({
          where: { status: "PUBLISHED", ...dateWhere },
          orderBy: { createdAt: "desc" },
          take: perTypeLimit,
          select: {
            id: true,
            title: true,
            images: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          },
        });
        for (const p of posts) {
          items.push({
            type: "image",
            id: p.id,
            title: p.title,
            coverUrl: (p.images as string[])?.[0] ?? null,
            views: p.views,
            createdAt: p.createdAt,
            uploader: {
              id: p.uploader.id,
              name: p.uploader.nickname || p.uploader.username,
              avatar: p.uploader.avatar,
            },
          });
        }
      }

      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const sliced = items.slice(0, limit);
      const nextCursor = sliced.length === limit ? sliced[sliced.length - 1]?.createdAt.toISOString() : undefined;

      return { items: sliced, nextCursor };
    }),

  /** 热门内容 */
  trending: contentProcedure
    .input(
      z.object({
        type: z.enum(["video", "game", "image"]).optional(),
        metric: z.enum(["views", "likes", "favorites"]).default("views"),
        timeRange: z.enum(["today", "week", "month", "all"]).default("week"),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { metric, timeRange, limit } = input;
      const types = input.type ? [input.type] : (["video", "game", "image"] as const);

      const now = new Date();
      const sinceMap: Record<string, Date | undefined> = {
        today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        week: new Date(now.getTime() - 7 * DAY_MS),
        month: new Date(now.getTime() - 30 * DAY_MS),
        all: undefined,
      };
      const since = sinceMap[timeRange];
      const dateWhere = since ? { createdAt: { gte: since } } : {};

      type TrendItem = {
        type: "video" | "game" | "image";
        id: string;
        title: string;
        coverUrl: string | null;
        value: number;
        views: number;
        createdAt: Date;
        uploader: { id: string; name: string; avatar: string | null };
      };

      const items: TrendItem[] = [];

      if (types.includes("video")) {
        const videos = await ctx.prisma.video.findMany({
          where: { status: "PUBLISHED", ...dateWhere },
          orderBy:
            metric === "views"
              ? { views: "desc" }
              : metric === "likes"
                ? { likes: { _count: "desc" } }
                : { favorites: { _count: "desc" } },
          take: limit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
            _count: { select: { likes: true, favorites: true } },
          },
        });
        const sorted = videos;
        for (const v of sorted) {
          items.push({
            type: "video",
            id: v.id,
            title: v.title,
            coverUrl: v.coverUrl,
            value: metric === "views" ? v.views : v._count[metric],
            views: v.views,
            createdAt: v.createdAt,
            uploader: {
              id: v.uploader.id,
              name: v.uploader.nickname || v.uploader.username,
              avatar: v.uploader.avatar,
            },
          });
        }
      }

      if (types.includes("game")) {
        const games = await ctx.prisma.game.findMany({
          where: { status: "PUBLISHED", ...dateWhere },
          orderBy:
            metric === "views"
              ? { views: "desc" }
              : metric === "likes"
                ? { likes: { _count: "desc" } }
                : { favorites: { _count: "desc" } },
          take: limit,
          select: {
            id: true,
            title: true,
            coverUrl: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
            _count: { select: { likes: true, favorites: true } },
          },
        });
        const sorted = games;
        for (const g of sorted) {
          items.push({
            type: "game",
            id: g.id,
            title: g.title,
            coverUrl: g.coverUrl,
            value: metric === "views" ? g.views : g._count[metric],
            views: g.views,
            createdAt: g.createdAt,
            uploader: {
              id: g.uploader.id,
              name: g.uploader.nickname || g.uploader.username,
              avatar: g.uploader.avatar,
            },
          });
        }
      }

      if (types.includes("image")) {
        const posts = await ctx.prisma.imagePost.findMany({
          where: { status: "PUBLISHED", ...dateWhere },
          orderBy:
            metric === "views"
              ? { views: "desc" }
              : metric === "likes"
                ? { likes: { _count: "desc" } }
                : { favorites: { _count: "desc" } },
          take: limit,
          select: {
            id: true,
            title: true,
            images: true,
            views: true,
            createdAt: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
            _count: { select: { likes: true, favorites: true } },
          },
        });
        const sorted = posts;
        for (const p of sorted) {
          items.push({
            type: "image",
            id: p.id,
            title: p.title,
            coverUrl: (p.images as string[])?.[0] ?? null,
            value: metric === "views" ? p.views : p._count[metric],
            views: p.views,
            createdAt: p.createdAt,
            uploader: {
              id: p.uploader.id,
              name: p.uploader.nickname || p.uploader.username,
              avatar: p.uploader.avatar,
            },
          });
        }
      }

      items.sort((a, b) => b.value - a.value);
      return { items: items.slice(0, limit), metric, timeRange };
    }),

  // ==================== 推广中心 (referral:read) ====================

  /** 推广数据总览 */
  referralOverview: referralProcedure.query(async ({ ctx }) => {
    const [totalLinks, totalReferrals, totalClicks, totalUniqueClicks, totalPayments] = await Promise.all([
      ctx.prisma.referralLink.count(),
      ctx.prisma.referralRecord.count(),
      ctx.prisma.referralLink.aggregate({ _sum: { clicks: true } }),
      ctx.prisma.referralLink.aggregate({ _sum: { uniqueClicks: true } }),
      ctx.prisma.referralLink.aggregate({ _sum: { paymentCount: true, paymentAmount: true } }),
    ]);

    const [totalPointsAwarded, activeReferrers] = await Promise.all([
      ctx.prisma.referralRecord.aggregate({ _sum: { pointsAwarded: true } }),
      ctx.prisma.referralLink.groupBy({ by: ["userId"], _count: true }),
    ]);

    return {
      links: totalLinks,
      referrals: totalReferrals,
      clicks: totalClicks._sum.clicks || 0,
      uniqueClicks: totalUniqueClicks._sum.uniqueClicks || 0,
      payments: {
        count: totalPayments._sum.paymentCount || 0,
        amount: totalPayments._sum.paymentAmount || 0,
      },
      pointsAwarded: totalPointsAwarded._sum.pointsAwarded || 0,
      activeReferrers: activeReferrers.length,
    };
  }),

  /** 推广排行榜 */
  referralLeaderboard: referralProcedure
    .input(
      z.object({
        metric: z.enum(["referrals", "clicks", "points"]).default("referrals"),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { metric, limit } = input;

      if (metric === "points") {
        const users = await ctx.prisma.user.findMany({
          where: { isBanned: false, points: { gt: 0 } },
          orderBy: { points: "desc" },
          take: limit,
          select: { id: true, nickname: true, username: true, avatar: true, points: true },
        });
        return {
          items: users.map((u) => ({
            userId: u.id,
            name: u.nickname || u.username,
            avatar: u.avatar,
            value: u.points,
          })),
        };
      }

      const links = await ctx.prisma.referralLink.findMany({
        orderBy: metric === "referrals" ? { registers: "desc" } : { uniqueClicks: "desc" },
        take: limit * 3,
        select: {
          userId: true,
          registers: true,
          uniqueClicks: true,
          user: { select: { id: true, nickname: true, username: true, avatar: true, isBanned: true } },
        },
      });

      const userMap = new Map<string, { name: string; avatar: string | null; value: number }>();
      for (const l of links) {
        if (l.user.isBanned) continue;
        const prev = userMap.get(l.userId);
        const val = metric === "referrals" ? l.registers : l.uniqueClicks;
        if (prev) {
          prev.value += val;
        } else {
          userMap.set(l.userId, { name: l.user.nickname || l.user.username, avatar: l.user.avatar, value: val });
        }
      }

      const sorted = [...userMap.entries()]
        .map(([userId, d]) => ({ userId, ...d }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

      return { items: sorted };
    }),

  /** 推广渠道统计 */
  referralChannelStats: referralProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.prisma.referralLink.findMany({
        where: { channel: { not: null } },
        select: { channel: true, clicks: true, uniqueClicks: true, registers: true, paymentCount: true },
      });

      const channelMap = new Map<
        string,
        { clicks: number; uniqueClicks: number; registers: number; payments: number }
      >();
      for (const l of links) {
        const ch = l.channel || "未分类";
        const prev = channelMap.get(ch) ?? { clicks: 0, uniqueClicks: 0, registers: 0, payments: 0 };
        prev.clicks += l.clicks;
        prev.uniqueClicks += l.uniqueClicks;
        prev.registers += l.registers;
        prev.payments += l.paymentCount;
        channelMap.set(ch, prev);
      }

      const sorted = [...channelMap.entries()]
        .map(([channel, stats]) => ({ channel, ...stats }))
        .sort((a, b) => b.registers - a.registers)
        .slice(0, input.limit);

      return { items: sorted };
    }),

  // ==================== 支付 (payment:read) ====================

  /** 公开套餐列表 */
  paymentPackages: paymentProcedure.query(async ({ ctx }) => {
    const packages = await ctx.prisma.paymentPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        amount: true,
        pointsAmount: true,
        grantUpload: true,
        description: true,
      },
    });
    return { items: packages };
  }),

  // ==================== 用户数据导出 (user:read, 自管理) ====================

  /** 导出当前用户的收藏列表 */
  exportMyFavorites: apiScopedProcedure("user:read")
    .input(z.object({ type: z.enum(["video", "game", "image"]).optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const result: Record<string, unknown[]> = {};

      if (!input.type || input.type === "video") {
        const favs = await ctx.prisma.favorite.findMany({
          where: { userId },
          select: { createdAt: true, video: { select: { id: true, title: true, coverUrl: true } } },
          orderBy: { createdAt: "desc" },
        });
        result.videos = favs.map((f) => ({ ...f.video, favoritedAt: f.createdAt }));
      }

      if (!input.type || input.type === "game") {
        const favs = await ctx.prisma.gameFavorite.findMany({
          where: { userId },
          select: { createdAt: true, game: { select: { id: true, title: true, coverUrl: true } } },
          orderBy: { createdAt: "desc" },
        });
        result.games = favs.map((f) => ({ ...f.game, favoritedAt: f.createdAt }));
      }

      if (!input.type || input.type === "image") {
        const favs = await ctx.prisma.imagePostFavorite.findMany({
          where: { userId },
          select: { createdAt: true, imagePost: { select: { id: true, title: true } } },
          orderBy: { createdAt: "desc" },
        });
        result.images = favs.map((f) => ({ ...f.imagePost, favoritedAt: f.createdAt }));
      }

      return result;
    }),

  /** 导出当前用户的浏览历史 */
  exportMyHistory: apiScopedProcedure("user:read")
    .input(z.object({ limit: z.number().min(1).max(1000).default(500) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;

      const [videoHistory, gameHistory, imageHistory] = await Promise.all([
        ctx.prisma.watchHistory.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          select: { createdAt: true, video: { select: { id: true, title: true } } },
        }),
        ctx.prisma.gameViewHistory.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          select: { createdAt: true, game: { select: { id: true, title: true } } },
        }),
        ctx.prisma.imagePostViewHistory.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          select: { createdAt: true, imagePost: { select: { id: true, title: true } } },
        }),
      ]);

      return {
        videos: videoHistory.map((h) => ({ ...h.video, viewedAt: h.createdAt })),
        games: gameHistory.map((h) => ({ ...h.game, viewedAt: h.createdAt })),
        images: imageHistory.map((h) => ({ ...h.imagePost, viewedAt: h.createdAt })),
      };
    }),

  // ==================== 站点公开信息 ====================

  /** 面向第三方的站点元数据 */
  siteInfo: publicProcedure.query(async ({ ctx }) => {
    const [userCount, videoCount, gameCount, imageCount] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.video.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.game.count({ where: { status: "PUBLISHED" } }),
      ctx.prisma.imagePost.count({ where: { status: "PUBLISHED" } }),
    ]);

    return {
      contentCounts: {
        users: userCount,
        videos: videoCount,
        games: gameCount,
        images: imageCount,
        total: videoCount + gameCount + imageCount,
      },
    };
  }),
});
