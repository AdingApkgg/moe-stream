/** 用户上传图片类型（与 /api/upload 的 type 参数一致） */
export const UPLOAD_IMAGE_TYPES = ["avatar", "cover", "misc", "sticker"] as const;
export type UploadImageType = (typeof UPLOAD_IMAGE_TYPES)[number];

export interface ImageCompressProfile {
  enabled: boolean;
  format: "webp" | "avif";
  quality: number;
  lossless: boolean;
  maxWidth: number;
  maxHeight: number;
}

export interface ImageCompressBypassConditions {
  mimeTypes: string[];
  uploadTypes: string[];
  /** 文件字节数 ≤ 该值时匹配（与规则中其它非空条件同时满足时绕过压缩） */
  maxFileSize: number | null;
}

export interface ImageCompressBypassRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: ImageCompressBypassConditions;
}

/** 与历史 upload 路由 IMAGE_CONFIG 一致的默认值 */
export const DEFAULT_IMAGE_COMPRESS_PROFILES: Record<UploadImageType, ImageCompressProfile> = {
  avatar: {
    enabled: true,
    format: "avif",
    quality: 100,
    lossless: true,
    maxWidth: 256,
    maxHeight: 256,
  },
  cover: {
    enabled: true,
    format: "avif",
    quality: 100,
    lossless: true,
    maxWidth: 1920,
    maxHeight: 1080,
  },
  misc: {
    enabled: true,
    format: "webp",
    quality: 85,
    lossless: false,
    maxWidth: 1920,
    maxHeight: 1080,
  },
  sticker: {
    enabled: true,
    format: "webp",
    quality: 90,
    lossless: false,
    maxWidth: 256,
    maxHeight: 256,
  },
};

export const DEFAULT_IMAGE_COMPRESS_BYPASS_RULES: ImageCompressBypassRule[] = [
  {
    id: "default-gif",
    name: "GIF 不压缩",
    enabled: true,
    conditions: { mimeTypes: ["image/gif"], uploadTypes: [], maxFileSize: null },
  },
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function parseProfile(raw: unknown, fallback: ImageCompressProfile): ImageCompressProfile {
  if (!isRecord(raw)) return { ...fallback };
  const format = raw.format === "webp" || raw.format === "avif" ? raw.format : fallback.format;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    format,
    quality: clampInt(Number(raw.quality), 1, 100),
    lossless: typeof raw.lossless === "boolean" ? raw.lossless : fallback.lossless,
    maxWidth: clampInt(Number(raw.maxWidth), 16, 8192),
    maxHeight: clampInt(Number(raw.maxHeight), 16, 8192),
  };
}

/** 合并 DB JSON 与默认值，保证四类齐全 */
export function mergeImageCompressProfiles(raw: unknown): Record<UploadImageType, ImageCompressProfile> {
  const src = isRecord(raw) ? raw : {};
  const out = {} as Record<UploadImageType, ImageCompressProfile>;
  for (const t of UPLOAD_IMAGE_TYPES) {
    out[t] = parseProfile(src[t], DEFAULT_IMAGE_COMPRESS_PROFILES[t]);
  }
  return out;
}

function parseBypassRule(raw: unknown, index: number): ImageCompressBypassRule | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id.slice(0, 80) : `rule-${index}`;
  const name = typeof raw.name === "string" ? raw.name.slice(0, 200) : "未命名规则";
  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;
  const condRaw = isRecord(raw.conditions) ? raw.conditions : {};
  const mimeTypes = Array.isArray(condRaw.mimeTypes)
    ? condRaw.mimeTypes.filter((m): m is string => typeof m === "string" && m.length > 0).map((m) => m.slice(0, 120))
    : [];
  const uploadTypes = Array.isArray(condRaw.uploadTypes)
    ? condRaw.uploadTypes.filter((u): u is string => typeof u === "string" && u.length > 0).map((u) => u.slice(0, 32))
    : [];
  let maxFileSize: number | null = null;
  if (condRaw.maxFileSize != null && condRaw.maxFileSize !== "") {
    const n = Number(condRaw.maxFileSize);
    if (!Number.isNaN(n) && n > 0) maxFileSize = clampInt(n, 1, 500 * 1024 * 1024);
  }
  return {
    id,
    name,
    enabled,
    conditions: { mimeTypes, uploadTypes, maxFileSize },
  };
}

export function mergeImageCompressBypassRules(raw: unknown): ImageCompressBypassRule[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_IMAGE_COMPRESS_BYPASS_RULES.map((r) => ({ ...r }));
  const parsed = raw.map((item, i) => parseBypassRule(item, i)).filter((r): r is ImageCompressBypassRule => r !== null);
  return parsed.length > 0 ? parsed : DEFAULT_IMAGE_COMPRESS_BYPASS_RULES.map((r) => ({ ...r }));
}

/**
 * 当规则启用且「所有已配置的条件」均满足时返回 true（跳过压缩）。
 * 至少需配置一类条件（MIME / 上传类型 / 大小上限其一），否则该规则永不匹配。
 */
export function imageMatchesBypassRule(
  rule: ImageCompressBypassRule,
  mimeType: string,
  uploadType: string,
  fileSizeBytes: number,
): boolean {
  if (!rule.enabled) return false;
  const { mimeTypes, uploadTypes, maxFileSize } = rule.conditions;
  let hasClause = false;
  if (mimeTypes.length > 0) {
    hasClause = true;
    if (!mimeTypes.includes(mimeType)) return false;
  }
  if (uploadTypes.length > 0) {
    hasClause = true;
    if (!uploadTypes.includes(uploadType)) return false;
  }
  if (maxFileSize != null) {
    hasClause = true;
    if (fileSizeBytes > maxFileSize) return false;
  }
  return hasClause;
}

export function shouldBypassImageCompress(
  rules: ImageCompressBypassRule[],
  mimeType: string,
  uploadType: string,
  fileSizeBytes: number,
): boolean {
  return rules.some((r) => imageMatchesBypassRule(r, mimeType, uploadType, fileSizeBytes));
}
