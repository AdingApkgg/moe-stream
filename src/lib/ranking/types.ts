/** 榜单内容类型 */
export type RankingContentType = "video" | "image" | "game" | "combined" | "tag";

/** 榜单分类 */
export type RankingCategory =
  | "score" /// 综合分（views/likes/favorites/comments 加权）
  | "surge" /// 飙升榜（当前 24h - 前 24h 加权分）
  | "fav_period" /// 周期内新增收藏
  | "fav_total" /// 全站累计收藏
  | "tag_hot" /// 热门标签
  | "tag_surge"; /// 增长最快标签

/** 榜单时间周期 */
export type RankingPeriod = "1d" | "7d" | "30d" | "all";

/** 加权公式参数 */
export interface RankingWeights {
  views: number;
  likes: number;
  favorites: number;
  comments: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  views: 0.1,
  likes: 1,
  favorites: 3,
  comments: 2,
};

/** 综合榜各类型配额 */
export interface RankingCombinedQuota {
  video: number;
  image: number;
  game: number;
}

export const DEFAULT_COMBINED_QUOTA: RankingCombinedQuota = {
  video: 40,
  image: 30,
  game: 30,
};

/** 默认 Top N */
export const DEFAULT_TOP_N = 100;

/** 榜单单项（仅 id + score，详情按需 join） */
export interface RankingItem {
  id: string;
  score: number;
}
