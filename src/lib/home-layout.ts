/**
 * 首页与分区页布局配置
 *
 * - 落地页（/）：标题/副标题 + 3 张分区选择卡片（顺序、显隐、文案可配）
 * - 分区页（/video, /image, /game）：模块堆栈顺序与显隐、内容网格列数、inline 广告密度
 * - 预设：一键切换常用布局
 */

// ---------------------------------------------------------------------------
// 常量与类型
// ---------------------------------------------------------------------------

export const LANDING_CARD_IDS = ["video", "image", "game"] as const;
export type LandingCardId = (typeof LANDING_CARD_IDS)[number];

export const SECTION_MODULE_IDS = ["headerBanner", "announcement", "tagBar", "mainGrid"] as const;
export type SectionModuleId = (typeof SECTION_MODULE_IDS)[number];

export const MOBILE_COLUMN_OPTIONS = [1, 2] as const;
export type MobileColumns = (typeof MOBILE_COLUMN_OPTIONS)[number];

export const DESKTOP_COLUMN_OPTIONS = [2, 3, 4] as const;
export type DesktopColumns = (typeof DESKTOP_COLUMN_OPTIONS)[number];

export interface SectionGridColumns {
  mobile: MobileColumns;
  desktop: DesktopColumns;
}

export const HOME_LAYOUT_PRESET_IDS = [
  "default",
  "compact",
  "videoFirst",
  "imageFirst",
  "adFriendly",
  "minimal",
] as const;
export type HomeLayoutPresetId = (typeof HOME_LAYOUT_PRESET_IDS)[number];
export type HomeLayoutPreset = HomeLayoutPresetId | "custom";

export interface LandingCardConfig {
  id: LandingCardId;
  enabled: boolean;
  title: string;
  subtitle: string;
}

export interface SectionModuleConfig {
  id: SectionModuleId;
  enabled: boolean;
}

export interface HomeLayoutConfig {
  preset: HomeLayoutPreset;
  landing: {
    title: string;
    subtitle: string;
    cards: LandingCardConfig[];
  };
  section: {
    modules: SectionModuleConfig[];
    /** 主网格列数（移动端 / 桌面端独立） */
    gridColumns: SectionGridColumns;
    /** 每 N 条插一条 inline 广告，0 = 关闭 */
    adDensity: number;
  };
}

// 不允许禁用的模块（禁用后分区页就没内容了）
export const REQUIRED_SECTION_MODULES: readonly SectionModuleId[] = ["mainGrid"];

// UI 展示用的模块元信息
export const SECTION_MODULE_META: Record<SectionModuleId, { label: string; desc: string }> = {
  headerBanner: { label: "横幅广告", desc: "页面顶部的轮播横幅广告位" },
  announcement: { label: "公告栏", desc: "站点公告横幅（需在基本信息里启用公告）" },
  tagBar: { label: "筛选标签栏", desc: "排序、视图切换与热门标签" },
  mainGrid: { label: "主内容网格", desc: "视频/图片/游戏卡片列表（不可关闭）" },
};

export const LANDING_CARD_META: Record<LandingCardId, { defaultTitle: string; defaultSubtitle: string }> = {
  video: { defaultTitle: "看视频", defaultSubtitle: "浏览最新 ACGN 视频内容" },
  image: { defaultTitle: "看图片", defaultSubtitle: "鉴赏精选插画与同人图" },
  game: { defaultTitle: "找游戏", defaultSubtitle: "探索热门游戏资源下载" },
};

export const HOME_LAYOUT_PRESET_META: Record<HomeLayoutPresetId, { label: string; desc: string }> = {
  default: { label: "默认", desc: "官方推荐配置" },
  compact: { label: "紧凑", desc: "更多列、更少广告插入" },
  videoFirst: { label: "视频优先", desc: "视频卡片置顶、保留横幅" },
  imageFirst: { label: "图片优先", desc: "图片卡片置顶" },
  adFriendly: { label: "广告友好", desc: "横幅与 inline 广告密度更高" },
  minimal: { label: "极简", desc: "仅主网格，隐藏横幅/公告/广告" },
};

// ---------------------------------------------------------------------------
// 默认值
// ---------------------------------------------------------------------------

export const DEFAULT_HOME_LAYOUT: HomeLayoutConfig = {
  preset: "default",
  landing: {
    title: "你想看什么？",
    subtitle: "选择后我们会记住你的偏好，下次访问自动跳转",
    cards: LANDING_CARD_IDS.map((id) => ({
      id,
      enabled: true,
      title: LANDING_CARD_META[id].defaultTitle,
      subtitle: LANDING_CARD_META[id].defaultSubtitle,
    })),
  },
  section: {
    modules: SECTION_MODULE_IDS.map((id) => ({ id, enabled: true })),
    gridColumns: { mobile: 2, desktop: 4 },
    adDensity: 8,
  },
};

// ---------------------------------------------------------------------------
// 预设（仅覆盖相关字段，未覆盖字段保留当前值）
// ---------------------------------------------------------------------------

function landingCard(id: LandingCardId): LandingCardConfig {
  return {
    id,
    enabled: true,
    title: LANDING_CARD_META[id].defaultTitle,
    subtitle: LANDING_CARD_META[id].defaultSubtitle,
  };
}

export const HOME_LAYOUT_PRESETS: Record<HomeLayoutPresetId, Partial<HomeLayoutConfig>> = {
  default: {
    landing: {
      title: DEFAULT_HOME_LAYOUT.landing.title,
      subtitle: DEFAULT_HOME_LAYOUT.landing.subtitle,
      cards: LANDING_CARD_IDS.map(landingCard),
    },
    section: {
      modules: SECTION_MODULE_IDS.map((id) => ({ id, enabled: true })),
      gridColumns: { mobile: 2, desktop: 4 },
      adDensity: 8,
    },
  },
  compact: {
    section: {
      modules: SECTION_MODULE_IDS.map((id) => ({ id, enabled: true })),
      gridColumns: { mobile: 2, desktop: 4 },
      adDensity: 12,
    },
  },
  videoFirst: {
    landing: {
      title: DEFAULT_HOME_LAYOUT.landing.title,
      subtitle: DEFAULT_HOME_LAYOUT.landing.subtitle,
      cards: (["video", "image", "game"] as const).map(landingCard),
    },
  },
  imageFirst: {
    landing: {
      title: DEFAULT_HOME_LAYOUT.landing.title,
      subtitle: DEFAULT_HOME_LAYOUT.landing.subtitle,
      cards: (["image", "video", "game"] as const).map(landingCard),
    },
  },
  adFriendly: {
    section: {
      modules: SECTION_MODULE_IDS.map((id) => ({ id, enabled: true })),
      gridColumns: { mobile: 2, desktop: 3 },
      adDensity: 5,
    },
  },
  minimal: {
    section: {
      modules: SECTION_MODULE_IDS.map((id) => ({
        id,
        enabled: id === "tagBar" || id === "mainGrid",
      })),
      gridColumns: { mobile: 2, desktop: 4 },
      adDensity: 0,
    },
  },
};

// ---------------------------------------------------------------------------
// 合并（容错处理）
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampString(v: unknown, maxLen: number, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, maxLen);
}

function mergeLandingCards(raw: unknown): LandingCardConfig[] {
  const arr = Array.isArray(raw) ? raw : [];
  const map = new Map<LandingCardId, LandingCardConfig>();
  for (const item of arr) {
    if (!isRecord(item)) continue;
    const id = item.id;
    if (!LANDING_CARD_IDS.includes(id as LandingCardId)) continue;
    if (map.has(id as LandingCardId)) continue;
    map.set(id as LandingCardId, {
      id: id as LandingCardId,
      enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      title: clampString(item.title, 40, LANDING_CARD_META[id as LandingCardId].defaultTitle),
      subtitle: clampString(item.subtitle, 100, LANDING_CARD_META[id as LandingCardId].defaultSubtitle),
    });
  }
  // 补齐缺失的卡片（放在末尾）
  for (const id of LANDING_CARD_IDS) {
    if (!map.has(id)) map.set(id, landingCard(id));
  }
  return Array.from(map.values());
}

function mergeSectionModules(raw: unknown): SectionModuleConfig[] {
  const arr = Array.isArray(raw) ? raw : [];
  const map = new Map<SectionModuleId, SectionModuleConfig>();
  for (const item of arr) {
    if (!isRecord(item)) continue;
    const id = item.id;
    if (!SECTION_MODULE_IDS.includes(id as SectionModuleId)) continue;
    if (map.has(id as SectionModuleId)) continue;
    const enabled = REQUIRED_SECTION_MODULES.includes(id as SectionModuleId)
      ? true
      : typeof item.enabled === "boolean"
        ? item.enabled
        : true;
    map.set(id as SectionModuleId, { id: id as SectionModuleId, enabled });
  }
  for (const id of SECTION_MODULE_IDS) {
    if (!map.has(id)) {
      map.set(id, { id, enabled: true });
    }
  }
  return Array.from(map.values());
}

export function mergeHomeLayout(raw: unknown): HomeLayoutConfig {
  if (!isRecord(raw)) return structuredCloneSafe(DEFAULT_HOME_LAYOUT);

  const presetRaw = raw.preset;
  const preset: HomeLayoutPreset =
    presetRaw === "custom" || HOME_LAYOUT_PRESET_IDS.includes(presetRaw as HomeLayoutPresetId)
      ? (presetRaw as HomeLayoutPreset)
      : "default";

  const landingRaw = isRecord(raw.landing) ? raw.landing : {};
  const sectionRaw = isRecord(raw.section) ? raw.section : {};

  return {
    preset,
    landing: {
      title: clampString(landingRaw.title, 50, DEFAULT_HOME_LAYOUT.landing.title),
      subtitle: clampString(landingRaw.subtitle, 120, DEFAULT_HOME_LAYOUT.landing.subtitle),
      cards: mergeLandingCards(landingRaw.cards),
    },
    section: {
      modules: mergeSectionModules(sectionRaw.modules),
      gridColumns: mergeGridColumns(sectionRaw.gridColumns),
      adDensity: clampInt(sectionRaw.adDensity, 0, 50, 8),
    },
  };
}

function mergeGridColumns(raw: unknown): SectionGridColumns {
  // 向后兼容：老数据里 gridColumns 是数字 2|3|4，等同于 {mobile:2, desktop:number}
  if (typeof raw === "number" || typeof raw === "string") {
    const n = clampInt(raw, 2, 4, 4);
    const desktop: DesktopColumns = (DESKTOP_COLUMN_OPTIONS as readonly number[]).includes(n)
      ? (n as DesktopColumns)
      : 4;
    return { mobile: 2, desktop };
  }
  if (!isRecord(raw)) return { ...DEFAULT_HOME_LAYOUT.section.gridColumns };
  const mobileCandidate = clampInt(raw.mobile, 1, 2, 2);
  const desktopCandidate = clampInt(raw.desktop, 2, 4, 4);
  const mobile: MobileColumns = (MOBILE_COLUMN_OPTIONS as readonly number[]).includes(mobileCandidate)
    ? (mobileCandidate as MobileColumns)
    : 2;
  const desktop: DesktopColumns = (DESKTOP_COLUMN_OPTIONS as readonly number[]).includes(desktopCandidate)
    ? (desktopCandidate as DesktopColumns)
    : 4;
  return { mobile, desktop };
}

function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---------------------------------------------------------------------------
// 应用预设到当前布局
// ---------------------------------------------------------------------------

export function applyHomeLayoutPreset(current: HomeLayoutConfig, preset: HomeLayoutPresetId): HomeLayoutConfig {
  const override = HOME_LAYOUT_PRESETS[preset];
  const merged: HomeLayoutConfig = {
    preset,
    landing: {
      ...current.landing,
      ...(override.landing ?? {}),
      cards: override.landing?.cards ? override.landing.cards.map((c) => ({ ...c })) : current.landing.cards,
    },
    section: {
      ...current.section,
      ...(override.section ?? {}),
      modules: override.section?.modules ? override.section.modules.map((m) => ({ ...m })) : current.section.modules,
    },
  };
  return mergeHomeLayout(merged);
}

// ---------------------------------------------------------------------------
// 前台辅助：按模块 id 快速查询启用状态 & 模块顺序
// ---------------------------------------------------------------------------

export function getSectionModuleOrder(layout: HomeLayoutConfig): SectionModuleId[] {
  return layout.section.modules.map((m) => m.id);
}

export function isSectionModuleEnabled(layout: HomeLayoutConfig, id: SectionModuleId): boolean {
  if (REQUIRED_SECTION_MODULES.includes(id)) return true;
  return layout.section.modules.find((m) => m.id === id)?.enabled ?? true;
}

/** 分区页主网格的 Tailwind 栅格 class（移动端与桌面端独立） */
export function sectionGridClass({ mobile, desktop }: SectionGridColumns): string {
  const parts: string[] = [];
  parts.push(mobile === 1 ? "grid-cols-1" : "grid-cols-2");
  // sm 断点：移动端 1 列时升至 2 列，否则保持移动端列数
  if (mobile === 1) parts.push("sm:grid-cols-2");
  if (desktop >= 3) parts.push("lg:grid-cols-3");
  if (desktop >= 4) parts.push("xl:grid-cols-4");
  return parts.join(" ");
}
