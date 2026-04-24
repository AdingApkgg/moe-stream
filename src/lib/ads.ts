/**
 * 广告系统 —— 共享类型与工具函数
 */

/** 广告位标识 */
export type AdPosition = "all" | "sidebar" | "header" | "header-carousel" | "in-feed" | "ad-gate";

export const AD_POSITIONS: { value: AdPosition; label: string }[] = [
  { value: "all", label: "全部位置" },
  { value: "sidebar", label: "侧栏" },
  { value: "header", label: "顶栏" },
  { value: "header-carousel", label: "顶部轮播" },
  { value: "in-feed", label: "信息流" },
  { value: "ad-gate", label: "仅广告门" },
];

/** 具体广告位选项（不含"全部位置"），用于多选 UI */
export const AD_POSITION_SPECIFIC: { value: AdPosition; label: string }[] = AD_POSITIONS.filter(
  (p) => p.value !== "all",
);

/** 不同广告位的专用图片尺寸标识 */
export type AdImageSize = "banner" | "card" | "sidebar";

export const AD_IMAGE_SIZES: { value: AdImageSize; label: string; hint: string }[] = [
  { value: "banner", label: "横幅图", hint: "用于顶部轮播，推荐 1200×300" },
  { value: "card", label: "卡片图", hint: "用于信息流，推荐 640×360" },
  { value: "sidebar", label: "侧栏图", hint: "用于侧边栏，推荐 400×200" },
];

/** 广告位 slotId 的统一配置表：映射到 AdPosition 和 AdImageSize */
interface SlotConfig {
  position: AdPosition;
  imageSize: AdImageSize;
}

const SLOT_CONFIG: Record<string, SlotConfig> = {
  sidebar: { position: "sidebar", imageSize: "sidebar" },
  "video-sidebar": { position: "sidebar", imageSize: "sidebar" },
  header: { position: "header", imageSize: "banner" },
  "header-carousel": { position: "header-carousel", imageSize: "banner" },
  "in-feed": { position: "in-feed", imageSize: "card" },
  "ad-gate": { position: "ad-gate", imageSize: "card" },
};

/** 从 slotId 推导对应的 AdPosition，未知 slotId 返回 undefined（仅匹配 "all" 广告） */
export function resolveSlotPosition(slotId: string): AdPosition | undefined {
  return SLOT_CONFIG[slotId]?.position;
}

/** 从 slotId 推导对应的图片尺寸类型 */
export function resolveSlotImageSize(slotId: string): AdImageSize | undefined {
  return SLOT_CONFIG[slotId]?.imageSize;
}

const VALID_POSITIONS: Set<string> = new Set(AD_POSITIONS.map((p) => p.value));

/** 各广告位尺寸的专用图片 URL */
export interface AdImages {
  banner?: string;
  card?: string;
  sidebar?: string;
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
  /** 默认广告图片链接（各尺寸未配置时的回退） */
  imageUrl?: string;
  /** 各广告位专用图片（未配置的尺寸回退到 imageUrl） */
  images?: AdImages;
  /** 权重（数值越大被选中概率越高，默认 1） */
  weight: number;
  /** 是否启用（false 时不展示） */
  enabled: boolean;
  /** 展示位置列表（包含 "all" 表示所有位置） */
  positions: AdPosition[];
  /** 投放开始时间（ISO string，为空表示立即开始） */
  startDate?: string | null;
  /** 投放结束时间（ISO string，为空表示长期有效） */
  endDate?: string | null;
  /** 创建时间 */
  createdAt?: string;
}

/**
 * 根据广告位选取最合适的图片 URL。
 * 优先使用该位置对应尺寸的专用图，未配置则回退到默认 imageUrl。
 */
export function getAdImage(ad: Ad, slotId?: string): string | undefined {
  if (slotId && ad.images) {
    const size = resolveSlotImageSize(slotId);
    if (size) {
      const url = ad.images[size];
      if (url) return url;
    }
  }
  return ad.imageUrl;
}

/** 从原始对象解析各广告位专用图片 URL */
export function parseAdImages(raw: unknown): AdImages | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const result: AdImages = {};
  if (typeof obj.banner === "string" && obj.banner) result.banner = obj.banner;
  if (typeof obj.card === "string" && obj.card) result.card = obj.card;
  if (typeof obj.sidebar === "string" && obj.sidebar) result.sidebar = obj.sidebar;
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * 从 SiteConfig.sponsorAds JSON 字段解析广告列表。
 * 统一处理旧数据兼容、字段缺省、类型校验，供客户端和管理端共用。
 */
export function parseSponsorAds(raw: unknown): Ad[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => ({
    id: item?.id ?? `legacy-${idx}`,
    title: item?.title ?? "",
    platform: item?.platform ?? "",
    url: item?.url ?? "",
    description: item?.description || undefined,
    imageUrl: item?.imageUrl || undefined,
    images: parseAdImages(item?.images),
    weight: typeof item?.weight === "number" ? item.weight : 1,
    enabled: item?.enabled !== false,
    positions: normalizePositions(item ?? {}),
    startDate: item?.startDate ?? null,
    endDate: item?.endDate ?? null,
    createdAt: item?.createdAt ?? undefined,
  }));
}

/** 将旧版单一 position 字段规范化为 positions 数组（兼容旧数据） */
export function normalizePositions(item: { position?: string; positions?: string[] }): AdPosition[] {
  if (Array.isArray(item.positions) && item.positions.length > 0) {
    return item.positions.filter((p): p is AdPosition => VALID_POSITIONS.has(p));
  }
  const pos = item.position;
  if (!pos || !VALID_POSITIONS.has(pos)) return ["all"];
  return [pos as AdPosition];
}

/** 获取广告位置的显示文本 */
export function getPositionsLabel(positions: AdPosition[]): string {
  if (positions.length === 0 || positions.includes("all")) return "全部位置";
  return positions.map((p) => AD_POSITIONS.find((ap) => ap.value === p)?.label ?? p).join("、");
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

/** 检查广告是否匹配指定广告位 */
export function isAdForPosition(ad: Ad, slotPosition?: string): boolean {
  const positions = ad.positions;
  if (!positions || positions.length === 0 || positions.includes("all")) return true;
  if (!slotPosition) return false;
  return positions.includes(slotPosition as AdPosition);
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
