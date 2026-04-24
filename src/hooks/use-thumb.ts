"use client";

import { useCallback } from "react";
import { useSiteConfig } from "@/contexts/site-config";
import {
  DEFAULT_THUMBNAIL_PRESETS,
  getThumbnailUrl,
  getVideoCoverThumbUrl,
  type ThumbnailPresetName,
  type ThumbOverride,
} from "@/lib/thumbnail-presets";

/**
 * 图片/游戏/通用缩略图 hook。按档位名读取后台配置，返回 `(url, override?) => string`。
 * 可选 `aspect` 强制宽高比，自动按 preset.width 推导 h（例：16/9 用于游戏/视频卡）。
 *
 * 例：
 *   const thumb = useThumb("gridPrimary");
 *   <img src={thumb(url)} />
 *
 *   // 16:9 游戏卡
 *   const gameCover = useThumb("gridPrimary", 16 / 9);
 *   <img src={gameCover(url)} />
 *
 *   // 单次 override
 *   <img src={thumb(url, { h: 270 })} />
 */
export function useThumb(name: ThumbnailPresetName, aspect?: number) {
  const cfg = useSiteConfig();
  const preset = cfg?.thumbnailPresets?.[name] ?? DEFAULT_THUMBNAIL_PRESETS[name];
  const proxyEnabled = cfg?.coverProxyThumbEnabled !== false;

  return useCallback(
    (url: string, override?: ThumbOverride) => {
      const mergedOverride: ThumbOverride = { ...override };
      if (aspect && aspect > 0 && mergedOverride.h === undefined) {
        mergedOverride.h = Math.max(16, Math.round((override?.w ?? preset.width) / aspect));
      }
      return getThumbnailUrl(url, preset, proxyEnabled, mergedOverride);
    },
    [preset, proxyEnabled, aspect],
  );
}

/**
 * 视频封面 hook。`coverUrl` 为空时回落到 `/api/cover/video/:id`。
 * 默认按 16:9 自动推导高度；`aspect` 传 0 或负数则完全沿用 preset 的 width/height。
 *
 * 例：
 *   const cover = useVideoCoverThumb("sideList");
 *   <img src={cover(video.id, video.coverUrl)} />
 */
export function useVideoCoverThumb(name: ThumbnailPresetName, aspect: number = 16 / 9) {
  const cfg = useSiteConfig();
  const preset = cfg?.thumbnailPresets?.[name] ?? DEFAULT_THUMBNAIL_PRESETS[name];
  const proxyEnabled = cfg?.coverProxyThumbEnabled !== false;

  return useCallback(
    (videoId: string, coverUrl: string | null | undefined, override?: ThumbOverride) => {
      const mergedOverride: ThumbOverride = { ...override };
      if (aspect > 0 && mergedOverride.h === undefined) {
        mergedOverride.h = Math.max(16, Math.round((override?.w ?? preset.width) / aspect));
      }
      return getVideoCoverThumbUrl(videoId, coverUrl, preset, proxyEnabled, mergedOverride);
    },
    [preset, proxyEnabled, aspect],
  );
}
