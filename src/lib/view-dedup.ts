import { redisIncr, redisSetNX } from "@/lib/redis";

/** 同一 visitor / IP 对同一内容的去重窗口（24 小时） */
const VIEW_DEDUP_TTL = 24 * 60 * 60;

/** IP 全局调用频率窗口与上限（1 分钟内最多 60 次 incrementViews） */
const IP_RATE_WINDOW = 60;
const IP_RATE_LIMIT = 60;

export type ViewTarget = "video" | "image" | "game";

export interface ViewDedupInput {
  type: ViewTarget;
  contentId: string;
  visitorId: string;
  ipv4: string | null;
  ipv6: string | null;
}

export interface ViewDedupResult {
  allow: boolean;
  reason?: "duplicate" | "rate_limit";
}

/**
 * 浏览量去重 & 防刷。三道闸门，任一不通过即拒绝：
 *   1) IP 全局限流：单 IP 1 分钟内调用 > 60 次拒绝，防 UUID 轮转刷量
 *   2) visitorId 去重：同一 visitorId 对同一内容 24h 内仅计 1 次
 *   3) IP 去重：同一 IP 对同一内容 24h 内仅计 1 次（visitorId 伪造时兜底）
 *
 * Redis 不可用时所有检查放行（依赖底层 helper 的容错行为）。
 */
export async function checkViewDedup(input: ViewDedupInput): Promise<ViewDedupResult> {
  const ip = input.ipv4 ?? input.ipv6;

  if (ip) {
    const count = await redisIncr(`view:ratelimit:${ip}`, IP_RATE_WINDOW);
    if (count > IP_RATE_LIMIT) {
      return { allow: false, reason: "rate_limit" };
    }
  }

  const visitorKey = `view:${input.type}:${input.contentId}:visitor:${input.visitorId}`;
  const visitorOk = await redisSetNX(visitorKey, "1", VIEW_DEDUP_TTL);
  if (!visitorOk) {
    return { allow: false, reason: "duplicate" };
  }

  if (ip) {
    const ipKey = `view:${input.type}:${input.contentId}:ip:${ip}`;
    const ipOk = await redisSetNX(ipKey, "1", VIEW_DEDUP_TTL);
    if (!ipOk) {
      return { allow: false, reason: "duplicate" };
    }
  }

  return { allow: true };
}
