import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { memGetOrSet } from "@/lib/memory-cache";
import { splitSearchTokens, suggestionTextRank } from "@/lib/search-text";
import { meili, INDEX } from "@/lib/meilisearch";
import { meiliQuoteFilterValue } from "@/lib/search-index-config";
import { redis, REDIS_AVAILABLE } from "@/lib/redis";
import {
  computeUserInterestTags,
  findCoOccurringTags,
  buildAnonymousCandidates,
  getRecentHotKeywords,
  GUESS_CACHE_TTL_SEC,
  type GuessCandidate,
} from "@/lib/search-recommend";

const SEARCH_COUNTS_TTL_MS = 60_000;
const SEARCH_ALL_TTL_MS = 60_000;
const HOT_CONTENTS_TTL_MS = 30 * 60_000;

/** 热力分维度权重：观看 / 点赞 / 收藏 / 评论 / 点踩 */
const HEAT_WEIGHT_VIEW = 1;
const HEAT_WEIGHT_LIKE = 10;
const HEAT_WEIGHT_FAVORITE = 15;
const HEAT_WEIGHT_COMMENT = 8;
const HEAT_WEIGHT_DISLIKE = 5;
/** 时间衰减半衰期（毫秒），7 天 */
const HEAT_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/** 「猜你想搜」混合权重：个人兴趣、共现发现、全站热门 */
const GUESS_WEIGHT_INTEREST = 100;
const GUESS_WEIGHT_RELATED = 30;
const GUESS_WEIGHT_HOT = 10;
/** 冷启动阈值：兴趣标签 < 3 个则回退到全站热门 */
const COLD_START_THRESHOLD = 3;

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

  /**
   * 猜你想搜：基于用户行为的个性化搜索词推荐。
   *
   * 算法：
   * - 登录用户：用户兴趣标签（收藏×3 + 点赞×2 + 观看×1，14 天半衰期）作为主导信号，
   *   叠加共现标签（探索发现）和全站热搜（保底多样性），按加权分数排序，最终带 ±10% 随机扰动。
   * - 匿名/冷启动（兴趣标签 < 3）：全站近 7 天热搜 + 热门标签池随机抽样。
   *
   * 缓存：Redis 每用户 10 分钟。
   */
  guessForMe: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id ?? null;
      const limit = input.limit;

      // Redis 结果缓存
      const cacheKey = userId ? `recommend:guess:${userId}:${limit}` : `recommend:guess:anon:${limit}`;
      if (userId && REDIS_AVAILABLE) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            return JSON.parse(cached) as {
              items: Array<{ keyword: string; score: number; isHot: boolean; reason: string }>;
              source: "personalized" | "hot-fallback";
            };
          }
        } catch {
          // 静默降级
        }
      }

      // 匿名用户直接走兜底
      if (!userId) {
        const items = await buildAnonymousCandidates(ctx.prisma, limit);
        return { items, source: "hot-fallback" as const };
      }

      // 登录用户：计算兴趣向量
      const userTags = await computeUserInterestTags(ctx.prisma, userId);

      // 冷启动
      if (userTags.length < COLD_START_THRESHOLD) {
        const items = await buildAnonymousCandidates(ctx.prisma, limit);
        return { items, source: "hot-fallback" as const };
      }

      // 并行获取共现标签 + 全站热搜
      const topTagIds = userTags.slice(0, 5).map((t) => t.tagId);
      const [coTags, hotKeywords] = await Promise.all([
        findCoOccurringTags(ctx.prisma, topTagIds, 15),
        getRecentHotKeywords(ctx.prisma, 20),
      ]);

      // 候选池（按关键词合并，保留最高优先 reason）
      const candidates = new Map<string, GuessCandidate>();
      const upsert = (keyword: string, score: number, reason: GuessCandidate["reason"], isHot = false) => {
        const key = keyword.toLowerCase();
        if (key.length < 2 || key.length > 20) return;
        const existing = candidates.get(key);
        if (existing) {
          existing.score += score;
          existing.isHot ||= isHot;
        } else {
          candidates.set(key, { keyword, score, isHot, reason });
        }
      };

      // 1. 个人兴趣标签（归一化到 0-100 × 100 权重）
      const maxInterest = userTags[0]?.score || 1;
      for (const t of userTags.slice(0, limit * 2)) {
        const normalized = (t.score / maxInterest) * 100;
        upsert(t.name, normalized * GUESS_WEIGHT_INTEREST, "interest");
      }

      // 2. 共现标签（探索发现）
      const maxCo = coTags[0]?.count || 1;
      for (const t of coTags) {
        const normalized = (t.count / maxCo) * 100;
        upsert(t.name, normalized * GUESS_WEIGHT_RELATED, "related");
      }

      // 3. 全站热搜保底
      hotKeywords.forEach((h, i) => {
        const normalized = ((hotKeywords.length - i) / hotKeywords.length) * 100;
        upsert(h.keyword, normalized * GUESS_WEIGHT_HOT, "hot", h.isHot);
      });

      // 4. 随机扰动（探索），截取 Top N
      const items = Array.from(candidates.values())
        .map((c) => ({ ...c, score: c.score * (0.9 + Math.random() * 0.2) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ keyword, score, isHot, reason }) => ({
          keyword,
          score: Math.round(score),
          isHot,
          reason,
        }));

      const result = { items, source: "personalized" as const };

      if (REDIS_AVAILABLE) {
        try {
          await redis.set(cacheKey, JSON.stringify(result), "EX", GUESS_CACHE_TTL_SEC);
        } catch {
          // 静默降级
        }
      }

      return result;
    }),

  /**
   * 站内热门内容：按多维度热力分排序的具体内容（视频 / 游戏 / 图帖）。
   *
   * 热力分：raw = views·1 + likes·10 + favorites·15 + comments·8 - dislikes·5
   *        heat = max(0, raw) × exp(-age_ms / 7天)  // 指数时间衰减，偏向近期
   *
   * 缓存：30 分钟内存缓存。
   */
  getHotContents: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `search:hot-contents:${input.limit}`;
      return memGetOrSet(
        cacheKey,
        async () => {
          const now = Date.now();

          const calcHeat = (d: {
            views: number;
            createdAt: Date;
            _count: { likes: number; dislikes: number; favorites: number; comments: number };
          }) => {
            const raw =
              d.views * HEAT_WEIGHT_VIEW +
              d._count.likes * HEAT_WEIGHT_LIKE +
              d._count.favorites * HEAT_WEIGHT_FAVORITE +
              d._count.comments * HEAT_WEIGHT_COMMENT -
              d._count.dislikes * HEAT_WEIGHT_DISLIKE;
            const ageMs = Math.max(0, now - new Date(d.createdAt).getTime());
            return Math.max(0, raw) * Math.exp(-ageMs / HEAT_HALF_LIFE_MS);
          };

          // 每种内容按浏览量降序预筛候选池（limit × 3），再按热力分统一排序。
          // 不设时间窗——7 天半衰期的指数衰减已足以让老内容自然沉底。
          const fetchLimit = input.limit * 3;

          const [videos, games, imagePosts] = await Promise.all([
            ctx.prisma.video.findMany({
              where: { status: "PUBLISHED" },
              select: {
                id: true,
                title: true,
                coverUrl: true,
                views: true,
                isNsfw: true,
                createdAt: true,
                _count: { select: { likes: true, dislikes: true, favorites: true, comments: true } },
              },
              orderBy: { views: "desc" },
              take: fetchLimit,
            }),
            ctx.prisma.game.findMany({
              where: { status: "PUBLISHED" },
              select: {
                id: true,
                title: true,
                coverUrl: true,
                views: true,
                createdAt: true,
                _count: { select: { likes: true, dislikes: true, favorites: true, comments: true } },
              },
              orderBy: { views: "desc" },
              take: fetchLimit,
            }),
            ctx.prisma.imagePost.findMany({
              where: { status: "PUBLISHED" },
              select: {
                id: true,
                title: true,
                images: true,
                views: true,
                isNsfw: true,
                createdAt: true,
                _count: { select: { likes: true, dislikes: true, favorites: true, comments: true } },
              },
              orderBy: { views: "desc" },
              take: fetchLimit,
            }),
          ]);

          const pickImageCover = (images: unknown): string | null => {
            if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") {
              return images[0];
            }
            return null;
          };

          type HotItem = {
            type: "video" | "game" | "image";
            id: string;
            title: string;
            coverUrl: string | null;
            views: number;
            isNsfw: boolean;
            heat: number;
          };

          const videoItems: HotItem[] = videos.map((v) => ({
            type: "video" as const,
            id: v.id,
            title: v.title,
            coverUrl: v.coverUrl,
            views: v.views,
            isNsfw: v.isNsfw,
            heat: calcHeat(v),
          }));
          const gameItems: HotItem[] = games.map((g) => ({
            type: "game" as const,
            id: g.id,
            title: g.title,
            coverUrl: g.coverUrl,
            views: g.views,
            isNsfw: false,
            heat: calcHeat(g),
          }));
          const imageItems: HotItem[] = imagePosts.map((p) => ({
            type: "image" as const,
            id: p.id,
            title: p.title,
            coverUrl: pickImageCover(p.images),
            views: p.views,
            isNsfw: p.isNsfw,
            heat: calcHeat(p),
          }));

          // 每类各取热度前 K 名（K = ⌈limit/3⌉），保证视频/游戏/图片三区都有曝光。
          // 合并后按热度排序，截到 limit。
          // 若某类候选不足，多出的名额由热度更高的其它类自然补齐。
          const perTypeK = Math.ceil(input.limit / 3);
          const sortByHeat = (a: HotItem, b: HotItem) => b.heat - a.heat;
          const merged = [
            ...videoItems.sort(sortByHeat).slice(0, perTypeK),
            ...gameItems.sort(sortByHeat).slice(0, perTypeK),
            ...imageItems.sort(sortByHeat).slice(0, perTypeK),
          ];

          return merged
            .sort(sortByHeat)
            .slice(0, input.limit)
            .map((item, index) => ({
              ...item,
              rank: index + 1,
              heat: Math.round(item.heat),
            }));
        },
        HOT_CONTENTS_TTL_MS,
      );
    }),
});
