/**
 * 广告系统 —— 共享类型与工具函数
 */

/** 广告位标识 */
export type AdPosition = "all" | "sidebar" | "header" | "in-feed" | "ad-gate";

export const AD_POSITIONS: { value: AdPosition; label: string }[] = [
  { value: "all", label: "全部位置" },
  { value: "sidebar", label: "侧栏" },
  { value: "header", label: "顶栏" },
  { value: "in-feed", label: "信息流" },
  { value: "ad-gate", label: "仅广告门" },
];

const SLOT_ID_TO_POSITION: Record<string, AdPosition> = {
  sidebar: "sidebar",
  header: "header",
  "in-feed": "in-feed",
  "video-sidebar": "sidebar",
  "ad-gate": "ad-gate",
};

/** 从 slotId 推导对应的 AdPosition，未知 slotId 返回 undefined（仅匹配 "all" 广告） */
export function resolveSlotPosition(slotId: string): AdPosition | undefined {
  return SLOT_ID_TO_POSITION[slotId];
}

/** 单条广告的数据结构（存储在 SiteConfig.sponsorAds JSON 中） */
export interface Ad {
  /** 唯一标识（uuid，用于编辑/删除） */
  id: string;
  /** 广告标题 / 名称 */
  title: string;
  /** 广告平台名（如"Google""百度联盟"等） */
  platform: string;
  /** 跳转链接 */
  url: string;
  /** 描述文案 */
  description?: string;
  /** 广告图片链接 */
  imageUrl?: string;
  /** 权重（数值越大被选中概率越高，默认 1） */
  weight: number;
  /** 是否启用（false 时不展示） */
  enabled: boolean;
  /** 广告位（默认 "all" 表示所有位置） */
  position: AdPosition;
  /** 投放开始时间（ISO string，为空表示立即开始） */
  startDate?: string | null;
  /** 投放结束时间（ISO string，为空表示长期有效） */
  endDate?: string | null;
  /** 创建时间 */
  createdAt?: string;
}

/** 检查广告是否在投放时间范围内 */
export function isAdInSchedule(ad: Ad, now = new Date()): boolean {
  if (ad.startDate) {
    const start = new Date(ad.startDate);
    if (now < start) return false;
  }
  if (ad.endDate) {
    const end = new Date(ad.endDate);
    if (now > end) return false;
  }
  return true;
}

const VALID_POSITIONS: Set<string> = new Set(AD_POSITIONS.map((p) => p.value));

/** 检查广告是否匹配指定广告位（未知的遗留位置值视为 "all"） */
export function isAdForPosition(ad: Ad, slotPosition?: string): boolean {
  if (!ad.position || ad.position === "all" || !VALID_POSITIONS.has(ad.position)) return true;
  if (!slotPosition) return false;
  return ad.position === slotPosition;
}

/**
 * 获取可用广告：启用 + 时间范围内 + 匹配广告位
 */
export function getActiveAds(ads: Ad[], slotPosition?: string): Ad[] {
  const now = new Date();
  return ads.filter((a) => a.enabled && isAdInSchedule(a, now) && isAdForPosition(a, slotPosition));
}

/**
 * 按权重随机选取 N 条不重复广告
 * @param ads    全量广告列表（仅启用的会参与选取）
 * @param count  需要选取的数量
 * @param slotPosition 广告位标识（可选，按位置过滤）
 * @returns      选中的广告数组（最多 count 条，如可用广告不足则返回全部可用）
 */
export function pickWeightedRandomAds(ads: Ad[], count: number, slotPosition?: string): Ad[] {
  const active = getActiveAds(ads, slotPosition);
  if (active.length === 0) return [];
  if (active.length <= count) return shuffle(active);

  const picked: Ad[] = [];
  const pool = active.map((a) => ({ ad: a, weight: Math.max(a.weight, 1) }));

  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].weight;
      if (rand <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(pool[idx].ad);
    pool.splice(idx, 1);
  }

  return picked;
}

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
