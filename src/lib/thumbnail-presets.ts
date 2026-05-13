/**
 * 前端缩略图档位系统
 *
 * 为什么做这件事：
 * 以前 `imageProxy(url, { w, q })` / `getCoverUrl(..., { w })` 散落着 20+ 处硬编码魔法数字，
 * 改尺寸 / 质量只能全仓 grep 替换。现在抽象出 6 档"语义预设"，由后台 Dashboard 统一配置。
 *
 * 6 档覆盖场景：
 * - gridPrimary    视频/图片/游戏列表的主封面
 * - gridSecondary  图片区列表卡背后堆叠的第 2、3 张附图
 * - detailGrid     图集详情页网格里每张图片
 * - sideList       剧集侧栏、相关视频、历史、收藏的中号封面
 * - microThumb     Lightbox 底部缩略带、排行榜小封面
 * - adminTable     后台管理 Dashboard 列表里的缩略
 *
 * 每档字段：
 * - width / height      缩略目标尺寸（像素，传给 sharp 的 resize）
 * - quality             WebP 质量 1-100
 * - forceThumb          true = 忽略后台 `coverProxyThumbEnabled` 全局开关，此档永远走缩略图代理
 */

export const THUMBNAIL_PRESET_NAMES = [
  "gridPrimary",
  "gridSecondary",
  "detailGrid",
  "sideList",
  "microThumb",
  "adminTable",
] as const;

export type ThumbnailPresetName = (typeof THUMBNAIL_PRESET_NAMES)[number];

export interface ThumbnailPreset {
  width: number;
  height: number;
  quality: number;
  forceThumb: boolean;
}

export type ThumbnailPresets = Record<ThumbnailPresetName, ThumbnailPreset>;

/** 后台 UI 渲染各档的文案（中文） */
export const THUMBNAIL_PRESET_META: Record<ThumbnailPresetName, { label: string; description: string }> = {
  gridPrimary: {
    label: "列表主封面",
    description: "视频/图片/游戏列表页的主封面图（一级卡片）",
  },
  gridSecondary: {
    label: "图集堆叠背景",
    description: "图片区列表卡背后堆叠的第 2、3 张附图（仅装饰，建议高压缩）",
  },
  detailGrid: {
    label: "图集详情网格",
    description: "进入图集详情页后网格里每一张图片",
  },
  sideList: {
    label: "侧边/相关列表",
    description: "剧集侧栏、相关视频、观看历史、收藏等中号封面",
  },
  microThumb: {
    label: "Lightbox 缩略 / 排行榜",
    description: "图片查看器底部缩略带、排行榜横向小卡",
  },
  adminTable: {
    label: "后台管理列表",
    description: "Dashboard 管理表格内的缩略图（视频/图片/游戏等）",
  },
};

export const DEFAULT_THUMBNAIL_PRESETS: ThumbnailPresets = {
  gridPrimary: { width: 400, height: 400, quality: 70, forceThumb: true },
  gridSecondary: { width: 120, height: 120, quality: 25, forceThumb: true },
  detailGrid: { width: 320, height: 320, quality: 60, forceThumb: true },
  sideList: { width: 200, height: 200, quality: 60, forceThumb: true },
  microThumb: { width: 96, height: 96, quality: 40, forceThumb: true },
  adminTable: { width: 160, height: 160, quality: 55, forceThumb: true },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function mergeOne(raw: unknown, dflt: ThumbnailPreset): ThumbnailPreset {
  if (!isRecord(raw)) return { ...dflt };
  return {
    width: clampInt(raw.width, 16, 4096, dflt.width),
    height: clampInt(raw.height, 16, 4096, dflt.height),
    quality: clampInt(raw.quality, 1, 100, dflt.quality),
    forceThumb: typeof raw.forceThumb === "boolean" ? raw.forceThumb : dflt.forceThumb,
  };
}

/** 从 DB Json 合并出完整的 6 档配置（缺失字段自动用默认值补齐） */
export function mergeThumbnailPresets(raw: unknown): ThumbnailPresets {
  const src = isRecord(raw) ? raw : {};
  const out = {} as ThumbnailPresets;
  for (const name of THUMBNAIL_PRESET_NAMES) {
    out[name] = mergeOne(src[name], DEFAULT_THUMBNAIL_PRESETS[name]);
  }
  return out;
}

/** 单次调用的覆盖参数。特殊宽高比场景（如视频 16:9、排行榜 3:2）传 `{ h }`，其余用档位默认 */
export interface ThumbOverride {
  w?: number;
  h?: number;
  q?: number;
}

// ---------------------------------------------------------------------------
// URL 构造
// ---------------------------------------------------------------------------

function appendThumbQuery(base: string, w: number, h: number, q: number): string {
  const sep = base.includes("?") ? "&" : "?";
  // h<=0 视为「保持宽高比」（瀑布流场景使用），URL 只带 w，sharp 端会按 w 等比缩放
  const parts = [`w=${w}`];
  if (h > 0) parts.push(`h=${h}`);
  parts.push(`q=${q}`);
  return `${base}${sep}${parts.join("&")}`;
}

function resolveThumb(preset: ThumbnailPreset, coverProxyThumbEnabled: boolean, override?: ThumbOverride) {
  const useThumb = preset.forceThumb || coverProxyThumbEnabled;
  return {
    useThumb,
    w: override?.w ?? preset.width,
    h: override?.h ?? preset.height,
    q: override?.q ?? preset.quality,
  };
}

/** 任意图片 URL 走 /api/cover 缩略 */
export function getThumbnailUrl(
  imageUrl: string,
  preset: ThumbnailPreset,
  coverProxyThumbEnabled: boolean,
  override?: ThumbOverride,
): string {
  const { useThumb, w, h, q } = resolveThumb(preset, coverProxyThumbEnabled, override);
  if (!useThumb) {
    if (imageUrl.startsWith("/uploads/")) return imageUrl;
    return `/api/cover/${encodeURIComponent(imageUrl)}`;
  }
  return appendThumbQuery(`/api/cover/${encodeURIComponent(imageUrl)}`, w, h, q);
}

/**
 * 视频封面：`coverUrl` 为空时回落到 `/api/cover/video/:id`（由后端按 videoId 自动抽帧返回）。
 */
export function getVideoCoverThumbUrl(
  videoId: string,
  coverUrl: string | null | undefined,
  preset: ThumbnailPreset,
  coverProxyThumbEnabled: boolean,
  override?: ThumbOverride,
): string {
  const { useThumb, w, h, q } = resolveThumb(preset, coverProxyThumbEnabled, override);
  let base: string;
  if (coverUrl) {
    if (coverUrl.startsWith("/uploads/") && !useThumb) return coverUrl;
    base = `/api/cover/${encodeURIComponent(coverUrl)}`;
  } else {
    base = `/api/cover/video/${videoId}`;
  }
  if (!useThumb) return base;
  return appendThumbQuery(base, w, h, q);
}
