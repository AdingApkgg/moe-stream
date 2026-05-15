import type { PublicSiteConfig } from "@/lib/site-config";
import {
  DEFAULT_COMBINED_QUOTA,
  DEFAULT_TOP_N,
  DEFAULT_WEIGHTS,
  type RankingCombinedQuota,
  type RankingWeights,
} from "./types";

/** 计算单条内容的加权分 */
export function calculateScore(
  counts: { views?: number; likes?: number; favorites?: number; comments?: number },
  weights: RankingWeights = DEFAULT_WEIGHTS,
): number {
  return (
    (counts.views ?? 0) * weights.views +
    (counts.likes ?? 0) * weights.likes +
    (counts.favorites ?? 0) * weights.favorites +
    (counts.comments ?? 0) * weights.comments
  );
}

function isRankingWeights(v: unknown): v is RankingWeights {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.views === "number" &&
    typeof o.likes === "number" &&
    typeof o.favorites === "number" &&
    typeof o.comments === "number"
  );
}

function isCombinedQuota(v: unknown): v is RankingCombinedQuota {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.video === "number" && typeof o.image === "number" && typeof o.game === "number";
}

/** 从 PublicSiteConfig 读取权重，未配置则用默认值 */
export function getWeights(config?: Pick<PublicSiteConfig, "rankingWeights"> | null): RankingWeights {
  return isRankingWeights(config?.rankingWeights) ? config.rankingWeights : DEFAULT_WEIGHTS;
}

/** 从 PublicSiteConfig 读取综合榜配额 */
export function getCombinedQuota(config?: Pick<PublicSiteConfig, "rankingCombinedQuota"> | null): RankingCombinedQuota {
  return isCombinedQuota(config?.rankingCombinedQuota) ? config.rankingCombinedQuota : DEFAULT_COMBINED_QUOTA;
}

/** 从 PublicSiteConfig 读取 Top N */
export function getTopN(config?: Pick<PublicSiteConfig, "rankingTopN"> | null): number {
  const n = config?.rankingTopN;
  return typeof n === "number" && n > 0 ? Math.min(n, 1000) : DEFAULT_TOP_N;
}
