"use client";

/**
 * 缓存图片的自然宽高比，给瀑布流卡片做「下次进来直接按真实比例占位」用，
 * 避免 3:4 默认占位 → 加载完成跳到自然比例引起的列重排抖动。
 *
 * - localStorage key 含版本号便于以后兼容性升级时一次性失效
 * - 仅在 onLoad 时写入；读取是同步的，挂载时即可拿到已知比例
 * - LRU 上限避免无限增长（用户长期浏览大量图）
 */

const STORAGE_KEY = "mikiacg.img-aspect.v1";
const MAX_ENTRIES = 500;

type Cache = Record<string, number>;

function read(): Cache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Cache) : {};
  } catch {
    return {};
  }
}

function write(cache: Cache) {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(cache);
    // 简易 LRU：超出上限时丢弃最早写入的（依赖 Object 插入顺序）
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    // 配额满 / 隐私模式等失败都静默忽略
  }
}

export function getCachedAspect(url: string): number | null {
  const ratio = read()[url];
  return typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function setCachedAspect(url: string, ratio: number): void {
  if (!url || !Number.isFinite(ratio) || ratio <= 0) return;
  const cache = read();
  // 写入时刷新到末尾，让 LRU 淘汰最久未访问的
  delete cache[url];
  cache[url] = Number(ratio.toFixed(4));
  write(cache);
}
