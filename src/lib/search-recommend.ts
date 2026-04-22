import type { PrismaClient } from "@/generated/prisma/client";
import { redis, REDIS_AVAILABLE } from "@/lib/redis";
import { memGet, memSet } from "@/lib/memory-cache";

// ==================== 算法常量 ====================

/** 兴趣半衰期（行为越早权重越低）。14 天 = 最近一周 × 0.6+，两周前 × 0.37 */
const INTEREST_HALFLIFE_MS = 14 * 24 * 60 * 60 * 1000;
/** 用户行为回溯窗口 */
const INTEREST_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
/** 用户兴趣向量缓存 TTL（Redis 秒） */
const INTEREST_CACHE_TTL_SEC = 3600;
/** 共现标签内存缓存 TTL */
const COTAG_CACHE_TTL_MS = 60 * 60 * 1000;
/** 最终「猜你想搜」结果缓存 TTL（Redis 秒） */
export const GUESS_CACHE_TTL_SEC = 600;

/** 行为权重 */
const W_FAVORITE = 3.0;
const W_LIKE = 2.0;
const W_VIEW = 1.0;

// ==================== 类型 ====================

export interface InterestTag {
  tagId: string;
  name: string;
  slug: string;
  score: number;
}

export interface CoTag {
  tagId: string;
  name: string;
  slug: string;
  count: number;
}

// ==================== 用户兴趣向量 ====================

/**
 * 计算用户兴趣标签向量（近 30 天的收藏/点赞/观看 → 标签加权累加 + 时间衰减）。
 * Redis 缓存 1 小时。
 */
export async function computeUserInterestTags(prisma: PrismaClient, userId: string): Promise<InterestTag[]> {
  const cacheKey = `recommend:user_tags:${userId}`;
  if (REDIS_AVAILABLE) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as InterestTag[];
    } catch {
      // 静默降级
    }
  }

  const now = Date.now();
  const lookback = new Date(now - INTEREST_LOOKBACK_MS);

  const tagSelect = {
    tag: { select: { id: true, name: true, slug: true } },
  } as const;

  const [
    favVideos,
    favGames,
    favImagePosts,
    likeVideos,
    likeGames,
    likeImagePosts,
    viewVideos,
    viewGames,
    viewImagePosts,
  ] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId, createdAt: { gte: lookback } },
      select: { createdAt: true, video: { select: { tags: { select: tagSelect } } } },
      take: 100,
    }),
    prisma.gameFavorite.findMany({
      where: { userId, createdAt: { gte: lookback } },
      select: { createdAt: true, game: { select: { tags: { select: tagSelect } } } },
      take: 100,
    }),
    prisma.imagePostFavorite.findMany({
      where: { userId, createdAt: { gte: lookback } },
      select: { createdAt: true, imagePost: { select: { tags: { select: tagSelect } } } },
      take: 100,
    }),
    prisma.like.findMany({
      where: { userId, createdAt: { gte: lookback } },
      select: { createdAt: true, video: { select: { tags: { select: tagSelect } } } },
      take: 150,
    }),
    prisma.gameLike.findMany({
      where: { userId, createdAt: { gte: lookback } },
      select: { createdAt: true, game: { select: { tags: { select: tagSelect } } } },
      take: 150,
    }),
    prisma.imagePostLike.findMany({
      where: { userId, createdAt: { gte: lookback } },
      select: { createdAt: true, imagePost: { select: { tags: { select: tagSelect } } } },
      take: 150,
    }),
    prisma.watchHistory.findMany({
      where: { userId, updatedAt: { gte: lookback } },
      select: { updatedAt: true, video: { select: { tags: { select: tagSelect } } } },
      take: 200,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.gameViewHistory.findMany({
      where: { userId, updatedAt: { gte: lookback } },
      select: { updatedAt: true, game: { select: { tags: { select: tagSelect } } } },
      take: 200,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.imagePostViewHistory.findMany({
      where: { userId, updatedAt: { gte: lookback } },
      select: { updatedAt: true, imagePost: { select: { tags: { select: tagSelect } } } },
      take: 200,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const tagMap = new Map<string, InterestTag>();
  const decay = (when: Date) => Math.exp(-(now - when.getTime()) / INTEREST_HALFLIFE_MS);

  type TagRel = { tag: { id: string; name: string; slug: string } };
  const accumulate = (rels: TagRel[], baseWeight: number, when: Date) => {
    const w = baseWeight * decay(when);
    for (const { tag } of rels) {
      const cur = tagMap.get(tag.id);
      if (cur) {
        cur.score += w;
      } else {
        tagMap.set(tag.id, { tagId: tag.id, name: tag.name, slug: tag.slug, score: w });
      }
    }
  };

  for (const r of favVideos) accumulate(r.video.tags, W_FAVORITE, r.createdAt);
  for (const r of favGames) accumulate(r.game.tags, W_FAVORITE, r.createdAt);
  for (const r of favImagePosts) accumulate(r.imagePost.tags, W_FAVORITE, r.createdAt);
  for (const r of likeVideos) accumulate(r.video.tags, W_LIKE, r.createdAt);
  for (const r of likeGames) accumulate(r.game.tags, W_LIKE, r.createdAt);
  for (const r of likeImagePosts) accumulate(r.imagePost.tags, W_LIKE, r.createdAt);
  for (const r of viewVideos) accumulate(r.video.tags, W_VIEW, r.updatedAt);
  for (const r of viewGames) accumulate(r.game.tags, W_VIEW, r.updatedAt);
  for (const r of viewImagePosts) accumulate(r.imagePost.tags, W_VIEW, r.updatedAt);

  const sorted = Array.from(tagMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  if (REDIS_AVAILABLE && sorted.length > 0) {
    try {
      await redis.set(cacheKey, JSON.stringify(sorted), "EX", INTEREST_CACHE_TTL_SEC);
    } catch {
      // 静默降级
    }
  }

  return sorted;
}

// ==================== 共现标签（关联发现） ====================

/**
 * 查找与给定标签集合共同出现的其他标签（跨视频/游戏/图帖）。
 * 用于扩展用户兴趣边界，发现新内容。内存缓存 1 小时。
 */
export async function findCoOccurringTags(prisma: PrismaClient, tagIds: string[], limit: number): Promise<CoTag[]> {
  if (tagIds.length === 0) return [];

  const cacheKey = `recommend:cotags:${[...tagIds].sort().join(",")}:${limit}`;
  const cached = memGet<CoTag[]>(cacheKey);
  if (cached) return cached;

  // PostgreSQL 单次查询：并集三类 TagOn* 表，统计共现频次
  const rows = await prisma.$queryRaw<Array<{ tagId: string; name: string; slug: string; count: bigint }>>`
    WITH co_tag_ids AS (
      SELECT "tagId" FROM "TagOnVideo"
      WHERE "videoId" IN (
        SELECT "videoId" FROM "TagOnVideo" WHERE "tagId" = ANY(${tagIds}::text[])
      )
      UNION ALL
      SELECT "tagId" FROM "TagOnGame"
      WHERE "gameId" IN (
        SELECT "gameId" FROM "TagOnGame" WHERE "tagId" = ANY(${tagIds}::text[])
      )
      UNION ALL
      SELECT "tagId" FROM "TagOnImagePost"
      WHERE "imagePostId" IN (
        SELECT "imagePostId" FROM "TagOnImagePost" WHERE "tagId" = ANY(${tagIds}::text[])
      )
    )
    SELECT t.id AS "tagId", t.name, t.slug, COUNT(*)::bigint AS count
    FROM co_tag_ids
    INNER JOIN "Tag" t ON t.id = co_tag_ids."tagId"
    WHERE NOT (t.id = ANY(${tagIds}::text[]))
    GROUP BY t.id, t.name, t.slug
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  const result: CoTag[] = rows.map((r) => ({
    tagId: r.tagId,
    name: r.name,
    slug: r.slug,
    count: Number(r.count),
  }));

  memSet(cacheKey, result, COTAG_CACHE_TTL_MS);
  return result;
}

// ==================== 匿名/冷启动候选池 ====================

export interface GuessCandidate {
  keyword: string;
  score: number;
  isHot: boolean;
  reason: "interest" | "related" | "hot" | "trending" | "popular";
}

/**
 * 匿名用户/冷启动场景的兜底候选池：近 7 天热搜 + 全站热门标签。
 * 叠加随机扰动保证每次展示略有差异。
 */
export async function buildAnonymousCandidates(prisma: PrismaClient, limit: number): Promise<GuessCandidate[]> {
  // 底层查询结果缓存 15 分钟，避免所有匿名用户每次击穿 DB
  const poolKey = "recommend:anon_pool";
  const cachedPool = memGet<GuessCandidate[]>(poolKey);

  let rawPool: GuessCandidate[];
  if (cachedPool) {
    rawPool = cachedPool;
  } else {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [topTags, recentSearches] = await Promise.all([
      prisma.tag.findMany({
        select: { name: true, videoCount: true, gameCount: true, imagePostCount: true },
        orderBy: [{ videoCount: "desc" }],
        take: 30,
      }),
      prisma.searchRecord.groupBy({
        by: ["keyword"],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { keyword: true },
        orderBy: { _count: { keyword: "desc" } },
        take: 30,
      }),
    ]);

    const pool = new Map<string, GuessCandidate>();

    recentSearches.forEach((r, i) => {
      const key = r.keyword.toLowerCase();
      if (key.length < 2 || key.length > 20) return;
      pool.set(key, {
        keyword: r.keyword,
        score: (30 - i) * 10 * Math.log10(r._count.keyword + 1),
        isHot: i < 3 && r._count.keyword > 5,
        reason: "trending",
      });
    });

    topTags.forEach((t, i) => {
      const key = t.name.toLowerCase();
      if (key.length < 2 || key.length > 20) return;
      const bump = (30 - i) * 5;
      const existing = pool.get(key);
      if (existing) {
        existing.score += bump;
      } else {
        pool.set(key, { keyword: t.name, score: bump, isHot: false, reason: "popular" });
      }
    });

    rawPool = Array.from(pool.values());
    memSet(poolKey, rawPool, 15 * 60 * 1000);
  }

  // 每次调用独立加噪，保证不同用户看到不同排序
  return rawPool
    .map((x) => ({ ...x, score: x.score * (0.85 + Math.random() * 0.3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ keyword, score, isHot, reason }) => ({
      keyword,
      score: Math.round(score),
      isHot,
      reason,
    }));
}

// ==================== 热搜关键词复用 ====================

/**
 * 获取最近 7 天热搜关键词（简化版，仅关键词和频次）。
 * 用于混入登录用户的推荐结果。
 */
export async function getRecentHotKeywords(
  prisma: PrismaClient,
  limit = 20,
): Promise<Array<{ keyword: string; count: number; isHot: boolean }>> {
  const cacheKey = `recommend:hot_keywords:${limit}`;
  const cached = memGet<Array<{ keyword: string; count: number; isHot: boolean }>>(cacheKey);
  if (cached) return cached;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.searchRecord.groupBy({
    by: ["keyword"],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: { keyword: true },
    orderBy: { _count: { keyword: "desc" } },
    take: limit,
  });

  const result = rows
    .filter((r) => r.keyword.length >= 2 && r.keyword.length <= 20)
    .map((r, i) => ({
      keyword: r.keyword,
      count: r._count.keyword,
      isHot: i < 3 && r._count.keyword > 5,
    }));

  memSet(cacheKey, result, 30 * 60 * 1000);
  return result;
}
