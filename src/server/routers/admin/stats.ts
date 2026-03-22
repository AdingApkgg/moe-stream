import { router, publicProcedure, protectedProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ADMIN_SCOPES } from "@/lib/constants";
import { isOwner as isOwnerRole, isPrivileged } from "@/lib/permissions";

const MAX_RANGE_DAYS = 90;
const DAY_MS = 1000 * 60 * 60 * 24;

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
}).refine(
  (d) => new Date(d.to) >= new Date(d.from),
  { message: "结束日期不能早于开始日期" },
).refine(
  (d) => {
    const days = computeDayCount(new Date(d.from), new Date(d.to));
    return days >= 1 && days <= MAX_RANGE_DAYS;
  },
  { message: `日期范围不能超过 ${MAX_RANGE_DAYS} 天` },
);

function computeDayCount(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1;
}

export const adminStatsRouter = router({
  // 获取当前用户的管理权限信息
  getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { role: true, adminScopes: true },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const isOwner = isOwnerRole(user.role);
    const isAdmin = isPrivileged(user.role);
    const scopes = isOwner
      ? Object.keys(ADMIN_SCOPES)
      : ((user.adminScopes as string[]) || []);

    return {
      role: user.role,
      isOwner,
      isAdmin,
      scopes,
      allScopes: ADMIN_SCOPES,
    };
  }),

  // 公开统计数据（所有人可见）
  getPublicStats: publicProcedure.query(async ({ ctx }) => {
    const [
      userCount,
      videoCount,
      gameCount,
      imagePostCount,
      tagCount,
      seriesCount,
      searchCount,
      // Views
      videoViews,
      gameViews,
      imageViews,
      // Video interactions
      videoLikes,
      videoDislikes,
      videoFavorites,
      videoComments,
      // Game interactions
      gameLikes,
      gameDislikes,
      gameFavorites,
      gameComments,
      // Image interactions
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
      // Views
      ctx.prisma.video.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
      ctx.prisma.game.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
      ctx.prisma.imagePost.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
      // Video
      ctx.prisma.like.count(),
      ctx.prisma.dislike.count(),
      ctx.prisma.favorite.count(),
      ctx.prisma.comment.count({ where: { isDeleted: false } }),
      // Game
      ctx.prisma.gameLike.count(),
      ctx.prisma.gameDislike.count(),
      ctx.prisma.gameFavorite.count(),
      ctx.prisma.gameComment.count({ where: { isDeleted: false } }),
      // Image
      ctx.prisma.imagePostLike.count(),
      ctx.prisma.imagePostDislike.count(),
      ctx.prisma.imagePostFavorite.count(),
      ctx.prisma.imagePostComment.count({ where: { isDeleted: false } }),
    ]);

    return {
      userCount,
      videoCount,
      gameCount,
      imagePostCount,
      tagCount,
      seriesCount,
      searchCount,
      totalViews: (videoViews._sum.views || 0) + (gameViews._sum.views || 0) + (imageViews._sum.views || 0),
      videoViews: videoViews._sum.views || 0,
      gameViews: gameViews._sum.views || 0,
      imageViews: imageViews._sum.views || 0,
      totalLikes: videoLikes + gameLikes + imagePostLikes,
      totalDislikes: videoDislikes + gameDislikes + imagePostDislikes,
      totalFavorites: videoFavorites + gameFavorites + imagePostFavorites,
      totalComments: videoComments + gameComments + imagePostComments,
      video: { likes: videoLikes, dislikes: videoDislikes, favorites: videoFavorites, comments: videoComments },
      game: { likes: gameLikes, dislikes: gameDislikes, favorites: gameFavorites, comments: gameComments },
      image: { likes: imagePostLikes, dislikes: imagePostDislikes, favorites: imagePostFavorites, comments: imagePostComments },
    };
  }),

  getLeaderboard: publicProcedure
    .input(
      z.object({
        type: z.enum(["video", "game", "image", "uploader", "points", "commentator", "collector", "liker"]),
        metric: z.enum(["views", "likes", "favorites", "comments", "uploads"]),
        limit: z.number().min(5).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { type, metric, limit } = input;

      // ========== 用户排行类别 ==========

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
            extra: { joinedAt: u.createdAt },
          })),
          type, metric,
        };
      }

      if (type === "commentator") {
        const [videoComments, gameComments, imageComments] = await Promise.all([
          ctx.prisma.comment.groupBy({ by: ["userId"], where: { isDeleted: false, userId: { not: null } }, _count: true }),
          ctx.prisma.gameComment.groupBy({ by: ["userId"], where: { isDeleted: false, userId: { not: null } }, _count: true }),
          ctx.prisma.imagePostComment.groupBy({ by: ["userId"], where: { isDeleted: false, userId: { not: null } }, _count: true }),
        ]);

        const commentMap = new Map<string, { video: number; game: number; image: number }>();
        for (const c of videoComments) {
          if (!c.userId) continue;
          const prev = commentMap.get(c.userId) ?? { video: 0, game: 0, image: 0 };
          prev.video = c._count;
          commentMap.set(c.userId, prev);
        }
        for (const c of gameComments) {
          if (!c.userId) continue;
          const prev = commentMap.get(c.userId) ?? { video: 0, game: 0, image: 0 };
          prev.game = c._count;
          commentMap.set(c.userId, prev);
        }
        for (const c of imageComments) {
          if (!c.userId) continue;
          const prev = commentMap.get(c.userId) ?? { video: 0, game: 0, image: 0 };
          prev.image = c._count;
          commentMap.set(c.userId, prev);
        }

        const sorted = [...commentMap.entries()]
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
                extra: { video: s.detail.video, game: s.detail.game, image: s.detail.image },
              };
            }),
          type, metric,
        };
      }

      if (type === "collector") {
        const [videoFavs, gameFavs, imageFavs] = await Promise.all([
          ctx.prisma.favorite.groupBy({ by: ["userId"], _count: true }),
          ctx.prisma.gameFavorite.groupBy({ by: ["userId"], _count: true }),
          ctx.prisma.imagePostFavorite.groupBy({ by: ["userId"], _count: true }),
        ]);

        const favMap = new Map<string, { video: number; game: number; image: number }>();
        for (const f of videoFavs) {
          const prev = favMap.get(f.userId) ?? { video: 0, game: 0, image: 0 };
          prev.video = f._count;
          favMap.set(f.userId, prev);
        }
        for (const f of gameFavs) {
          const prev = favMap.get(f.userId) ?? { video: 0, game: 0, image: 0 };
          prev.game = f._count;
          favMap.set(f.userId, prev);
        }
        for (const f of imageFavs) {
          const prev = favMap.get(f.userId) ?? { video: 0, game: 0, image: 0 };
          prev.image = f._count;
          favMap.set(f.userId, prev);
        }

        const sorted = [...favMap.entries()]
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
                extra: { video: s.detail.video, game: s.detail.game, image: s.detail.image },
              };
            }),
          type, metric,
        };
      }

      if (type === "liker") {
        const [videoLikes, gameLikes, imageLikes] = await Promise.all([
          ctx.prisma.like.groupBy({ by: ["userId"], _count: true }),
          ctx.prisma.gameLike.groupBy({ by: ["userId"], _count: true }),
          ctx.prisma.imagePostLike.groupBy({ by: ["userId"], _count: true }),
        ]);

        const likeMap = new Map<string, { video: number; game: number; image: number }>();
        for (const l of videoLikes) {
          const prev = likeMap.get(l.userId) ?? { video: 0, game: 0, image: 0 };
          prev.video = l._count;
          likeMap.set(l.userId, prev);
        }
        for (const l of gameLikes) {
          const prev = likeMap.get(l.userId) ?? { video: 0, game: 0, image: 0 };
          prev.game = l._count;
          likeMap.set(l.userId, prev);
        }
        for (const l of imageLikes) {
          const prev = likeMap.get(l.userId) ?? { video: 0, game: 0, image: 0 };
          prev.image = l._count;
          likeMap.set(l.userId, prev);
        }

        const sorted = [...likeMap.entries()]
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
                extra: { video: s.detail.video, game: s.detail.game, image: s.detail.image },
              };
            }),
          type, metric,
        };
      }

      if (type === "uploader") {
        const uploaders = await ctx.prisma.user.findMany({
          where: { isBanned: false },
          select: {
            id: true,
            nickname: true,
            username: true,
            avatar: true,
            _count: {
              select: {
                videos: { where: { status: "PUBLISHED" } },
                games: { where: { status: "PUBLISHED" } },
                imagePosts: { where: { status: "PUBLISHED" } },
              },
            },
          },
        });

        const ranked = uploaders
          .map((u) => ({
            userId: u.id,
            nickname: u.nickname || u.username,
            avatar: u.avatar,
            value: u._count.videos + u._count.games + u._count.imagePosts,
            detail: {
              videos: u._count.videos,
              games: u._count.games,
              images: u._count.imagePosts,
            },
          }))
          .filter((u) => u.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, limit);

        return { items: ranked, type, metric };
      }

      if (type === "video") {
        if (metric === "views") {
          const videos = await ctx.prisma.video.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { views: "desc" },
            take: limit,
            select: {
              id: true, title: true, coverUrl: true, views: true,
              uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
              _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
            },
          });
          return {
            items: videos.map((v) => ({
              id: v.id, title: v.title, coverUrl: v.coverUrl,
              value: v.views,
              uploader: { id: v.uploader.id, name: v.uploader.nickname || v.uploader.username, avatar: v.uploader.avatar },
              stats: { views: v.views, likes: v._count.likes, favorites: v._count.favorites, comments: v._count.comments },
            })),
            type, metric,
          };
        }
        if (metric === "likes") {
          const videos = await ctx.prisma.video.findMany({
            where: { status: "PUBLISHED" },
            select: {
              id: true, title: true, coverUrl: true, views: true,
              uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
              _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
            },
          });
          const sorted = videos.sort((a, b) => b._count.likes - a._count.likes).slice(0, limit);
          return {
            items: sorted.map((v) => ({
              id: v.id, title: v.title, coverUrl: v.coverUrl,
              value: v._count.likes,
              uploader: { id: v.uploader.id, name: v.uploader.nickname || v.uploader.username, avatar: v.uploader.avatar },
              stats: { views: v.views, likes: v._count.likes, favorites: v._count.favorites, comments: v._count.comments },
            })),
            type, metric,
          };
        }
        if (metric === "favorites") {
          const videos = await ctx.prisma.video.findMany({
            where: { status: "PUBLISHED" },
            select: {
              id: true, title: true, coverUrl: true, views: true,
              uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
              _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
            },
          });
          const sorted = videos.sort((a, b) => b._count.favorites - a._count.favorites).slice(0, limit);
          return {
            items: sorted.map((v) => ({
              id: v.id, title: v.title, coverUrl: v.coverUrl,
              value: v._count.favorites,
              uploader: { id: v.uploader.id, name: v.uploader.nickname || v.uploader.username, avatar: v.uploader.avatar },
              stats: { views: v.views, likes: v._count.likes, favorites: v._count.favorites, comments: v._count.comments },
            })),
            type, metric,
          };
        }
        // comments
        const videos = await ctx.prisma.video.findMany({
          where: { status: "PUBLISHED" },
          select: {
            id: true, title: true, coverUrl: true, views: true,
            uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
            _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
          },
        });
        const sorted = videos.sort((a, b) => b._count.comments - a._count.comments).slice(0, limit);
        return {
          items: sorted.map((v) => ({
            id: v.id, title: v.title, coverUrl: v.coverUrl,
            value: v._count.comments,
            uploader: { id: v.uploader.id, name: v.uploader.nickname || v.uploader.username, avatar: v.uploader.avatar },
            stats: { views: v.views, likes: v._count.likes, favorites: v._count.favorites, comments: v._count.comments },
          })),
          type, metric,
        };
      }

      if (type === "game") {
        const baseSelect = {
          id: true, title: true, coverUrl: true, views: true,
          uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
          _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
        } as const;

        if (metric === "views") {
          const games = await ctx.prisma.game.findMany({
            where: { status: "PUBLISHED" }, orderBy: { views: "desc" }, take: limit, select: baseSelect,
          });
          return {
            items: games.map((g) => ({
              id: g.id, title: g.title, coverUrl: g.coverUrl, value: g.views,
              uploader: { id: g.uploader.id, name: g.uploader.nickname || g.uploader.username, avatar: g.uploader.avatar },
              stats: { views: g.views, likes: g._count.likes, favorites: g._count.favorites, comments: g._count.comments },
            })),
            type, metric,
          };
        }
        const games = await ctx.prisma.game.findMany({
          where: { status: "PUBLISHED" }, select: baseSelect,
        });
        const key = metric === "likes" ? "likes" : metric === "favorites" ? "favorites" : "comments";
        const sorted = games.sort((a, b) => b._count[key] - a._count[key]).slice(0, limit);
        return {
          items: sorted.map((g) => ({
            id: g.id, title: g.title, coverUrl: g.coverUrl,
            value: g._count[key],
            uploader: { id: g.uploader.id, name: g.uploader.nickname || g.uploader.username, avatar: g.uploader.avatar },
            stats: { views: g.views, likes: g._count.likes, favorites: g._count.favorites, comments: g._count.comments },
          })),
          type, metric,
        };
      }

      // type === "image"
      const baseSelect = {
        id: true, title: true, views: true, images: true,
        uploader: { select: { id: true, nickname: true, username: true, avatar: true } },
        _count: { select: { likes: true, favorites: true, comments: { where: { isDeleted: false } } } },
      } as const;

      if (metric === "views") {
        const posts = await ctx.prisma.imagePost.findMany({
          where: { status: "PUBLISHED" }, orderBy: { views: "desc" }, take: limit, select: baseSelect,
        });
        return {
          items: posts.map((p) => ({
            id: p.id, title: p.title, coverUrl: (p.images as string[])?.[0] ?? null,
            value: p.views,
            uploader: { id: p.uploader.id, name: p.uploader.nickname || p.uploader.username, avatar: p.uploader.avatar },
            stats: { views: p.views, likes: p._count.likes, favorites: p._count.favorites, comments: p._count.comments },
          })),
          type, metric,
        };
      }
      const posts = await ctx.prisma.imagePost.findMany({
        where: { status: "PUBLISHED" }, select: baseSelect,
      });
      const key = metric === "likes" ? "likes" : metric === "favorites" ? "favorites" : "comments";
      const sorted = posts.sort((a, b) => b._count[key] - a._count[key]).slice(0, limit);
      return {
        items: sorted.map((p) => ({
          id: p.id, title: p.title, coverUrl: (p.images as string[])?.[0] ?? null,
          value: p._count[key],
          uploader: { id: p.uploader.id, name: p.uploader.nickname || p.uploader.username, avatar: p.uploader.avatar },
          stats: { views: p.views, likes: p._count.likes, favorites: p._count.favorites, comments: p._count.comments },
        })),
        type, metric,
      };
    }),

  getGrowthStats: publicProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const since = new Date(input.from);
      const until = new Date(input.to);
      const dateRange = { gte: since, lte: until };

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
        newUsers,
        newVideos,
        newGames,
        newImagePosts,
        newTags,
        newSeries,
        newSearches,
        newComments: newVideoComments + newGameComments + newImageComments,
        newViews: newVideoViews + newGameViews + newImageViews,
        newLikes: newVideoLikes + newGameLikes + newImageLikes,
        newFavorites: newVideoFavorites + newGameFavorites + newImageFavorites,
      };
    }),

  // 增长趋势数据（每日统计）
  getGrowthTrend: publicProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      const since = new Date(input.from);
      const until = new Date(input.to);
      const dateRange = { gte: since, lte: until };

      const [users, videos, images, games, videoViews, gameViews, imageViews, videoLikes, gameLikes, imageLikes, videoFavs, gameFavs, imageFavs, videoComments, gameComments, imageComments] = await Promise.all([
        ctx.prisma.user.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.video.findMany({ where: { createdAt: dateRange, status: "PUBLISHED" }, select: { createdAt: true } }),
        ctx.prisma.imagePost.findMany({ where: { createdAt: dateRange, status: "PUBLISHED" }, select: { createdAt: true } }),
        ctx.prisma.game.findMany({ where: { createdAt: dateRange, status: "PUBLISHED" }, select: { createdAt: true } }),
        ctx.prisma.watchHistory.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.gameViewHistory.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.imagePostViewHistory.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.like.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.gameLike.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.imagePostLike.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.favorite.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.gameFavorite.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.imagePostFavorite.findMany({ where: { createdAt: dateRange }, select: { createdAt: true } }),
        ctx.prisma.comment.findMany({ where: { createdAt: dateRange, isDeleted: false }, select: { createdAt: true } }),
        ctx.prisma.gameComment.findMany({ where: { createdAt: dateRange, isDeleted: false }, select: { createdAt: true } }),
        ctx.prisma.imagePostComment.findMany({ where: { createdAt: dateRange, isDeleted: false }, select: { createdAt: true } }),
      ]);

      type DayData = { users: number; videos: number; images: number; games: number; views: number; likes: number; favorites: number; comments: number };
      const trend: Record<string, DayData> = {};

      const dayCount = computeDayCount(since, until);
      const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const empty = (): DayData => ({ users: 0, videos: 0, images: 0, games: 0, views: 0, likes: 0, favorites: 0, comments: 0 });

      for (let i = 0; i < dayCount; i++) {
        const date = new Date(since);
        date.setDate(date.getDate() + i);
        trend[toKey(date)] = empty();
      }

      const inc = (rows: { createdAt: Date }[], field: keyof DayData) => {
        for (const r of rows) {
          const k = toKey(new Date(r.createdAt));
          if (trend[k]) trend[k][field]++;
        }
      };

      inc(users, "users");
      inc(videos, "videos");
      inc(images, "images");
      inc(games, "games");
      inc([...videoViews, ...gameViews, ...imageViews], "views");
      inc([...videoLikes, ...gameLikes, ...imageLikes], "likes");
      inc([...videoFavs, ...gameFavs, ...imageFavs], "favorites");
      inc([...videoComments, ...gameComments, ...imageComments], "comments");

      return Object.entries(trend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, ...data }));
    }),

});
