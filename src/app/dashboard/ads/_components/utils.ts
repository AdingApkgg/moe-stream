import { CheckCircle2, EyeOff, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { Ad } from "@/lib/ads";
import { isAdInSchedule } from "@/lib/ads";

export function genId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface AdStatusInfo {
  label: string;
  /** 徽章颜色方案，用于自定义 className */
  tone: "active" | "scheduled" | "expired" | "disabled";
  icon: LucideIcon;
}

/** 计算广告的投放状态 */
export function getAdStatus(ad: Ad): AdStatusInfo {
  if (!ad.enabled) return { label: "已禁用", tone: "disabled", icon: EyeOff };
  if (!isAdInSchedule(ad)) {
    const now = new Date();
    if (ad.startDate && new Date(ad.startDate) > now) return { label: "待投放", tone: "scheduled", icon: Clock };
    return { label: "已过期", tone: "expired", icon: XCircle };
  }
  return { label: "投放中", tone: "active", icon: CheckCircle2 };
}

/** 状态排序权重：投放中 > 待投放 > 已禁用 > 已过期 */
export function getAdStatusOrder(ad: Ad): number {
  const status = getAdStatus(ad);
  switch (status.tone) {
    case "active":
      return 0;
    case "scheduled":
      return 1;
    case "disabled":
      return 2;
    case "expired":
      return 3;
  }
}

/** 徽章 tone 对应的 className，用于渲染状态徽章 */
export const STATUS_TONE_CLASS: Record<AdStatusInfo["tone"], string> = {
  active: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  scheduled: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  disabled: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

/** 日期快捷预设：返回一个 `YYYY-MM-DD` 日期字符串（或 null 表示清空） */
export interface DatePreset {
  label: string;
  getValue: () => string | null;
  /** 适用于哪类日期字段（start 用于开始日期，end 用于结束日期） */
  scope: "start" | "end" | "both";
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const START_DATE_PRESETS: DatePreset[] = [
  {
    label: "立即",
    scope: "start",
    getValue: () => null,
  },
  {
    label: "今天",
    scope: "start",
    getValue: () => toIsoDate(new Date()),
  },
  {
    label: "明天",
    scope: "start",
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return toIsoDate(d);
    },
  },
  {
    label: "下周一",
    scope: "start",
    getValue: () => {
      const d = new Date();
      const dow = d.getDay(); // 0 (Sun) - 6 (Sat)
      const delta = (8 - dow) % 7 || 7;
      d.setDate(d.getDate() + delta);
      return toIsoDate(d);
    },
  },
];

/** 简单 URL 校验：空值视为有效 */
export function isValidUrl(v: string | null | undefined): boolean {
  if (!v || !v.trim()) return true;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/** 表单 Tab 标识 */
export type FormTab = "basic" | "images" | "schedule";

/** 单个字段可能的错误消息（null 表示无错） */
export interface FormErrors {
  title: string | null;
  url: string | null;
  imageUrl: string | null;
  bannerImage: string | null;
  cardImage: string | null;
  sidebarImage: string | null;
  dateRange: string | null;
  positions: string | null;
}

/** 每个错误字段所属的 Tab，用于点保存时跳转到第一个错误 Tab */
const FIELD_TAB: Record<keyof FormErrors, FormTab> = {
  title: "basic",
  url: "basic",
  imageUrl: "images",
  bannerImage: "images",
  cardImage: "images",
  sidebarImage: "images",
  dateRange: "schedule",
  positions: "schedule",
};

/** 每个字段对应的 DOM 锚点 id，便于滚动聚焦 */
export const FIELD_ANCHOR: Record<keyof FormErrors, string> = {
  title: "ad-form-title",
  url: "ad-form-url",
  imageUrl: "ad-form-image-url",
  bannerImage: "ad-form-image-banner",
  cardImage: "ad-form-image-card",
  sidebarImage: "ad-form-image-sidebar",
  dateRange: "ad-form-end-date",
  positions: "ad-form-positions",
};

interface MinimalForm {
  title: string;
  url: string;
  imageUrl?: string;
  images?: { banner?: string; card?: string; sidebar?: string };
  startDate?: string | null;
  endDate?: string | null;
  positions: string[];
}

/** 计算当前表单的所有校验错误 */
export function validateAdForm(form: MinimalForm): FormErrors {
  const range =
    form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)
      ? "结束日期需晚于开始日期"
      : null;
  return {
    title: !form.title.trim() ? "请填写广告标题" : null,
    url: !form.url.trim() ? "请填写跳转链接" : !isValidUrl(form.url) ? "URL 格式不正确" : null,
    imageUrl: !isValidUrl(form.imageUrl) ? "URL 格式不正确" : null,
    bannerImage: !isValidUrl(form.images?.banner) ? "URL 格式不正确" : null,
    cardImage: !isValidUrl(form.images?.card) ? "URL 格式不正确" : null,
    sidebarImage: !isValidUrl(form.images?.sidebar) ? "URL 格式不正确" : null,
    dateRange: range,
    positions: form.positions.length === 0 ? "请至少选择一个展示位置" : null,
  };
}

/** 各 Tab 是否存在错误 */
export function getTabErrors(errors: FormErrors): Record<FormTab, boolean> {
  const result: Record<FormTab, boolean> = { basic: false, images: false, schedule: false };
  for (const key of Object.keys(errors) as (keyof FormErrors)[]) {
    if (errors[key]) result[FIELD_TAB[key]] = true;
  }
  return result;
}

/** 找到第一个有错误的字段，返回 { tab, field } 或 null */
export function firstErrorField(errors: FormErrors): { tab: FormTab; field: keyof FormErrors } | null {
  const order: (keyof FormErrors)[] = [
    "title",
    "url",
    "imageUrl",
    "bannerImage",
    "cardImage",
    "sidebarImage",
    "positions",
    "dateRange",
  ];
  for (const field of order) {
    if (errors[field]) return { tab: FIELD_TAB[field], field };
  }
  return null;
}

export const END_DATE_PRESETS: DatePreset[] = [
  {
    label: "永久",
    scope: "end",
    getValue: () => null,
  },
  {
    label: "7 天后",
    scope: "end",
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return toIsoDate(d);
    },
  },
  {
    label: "30 天后",
    scope: "end",
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return toIsoDate(d);
    },
  },
  {
    label: "本月底",
    scope: "end",
    getValue: () => {
      const d = new Date();
      // 下个月 0 号 = 本月最后一天
      return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    },
  },
];
