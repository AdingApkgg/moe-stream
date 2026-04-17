"use client";

import { useCallback } from "react";
import { useSiteConfig } from "@/contexts/site-config";
import { getCoverUrl, getImageProxyUrl, type CoverThumb, type ImageProxyThumb } from "@/lib/cover";

/**
 * 根据后台「缩略图与封面代理」开关调用 getCoverUrl，自动决定是否附加 ?w/h/q。
 */
export function useCoverUrl() {
  const cfg = useSiteConfig();
  const proxyThumb = cfg?.coverProxyThumbEnabled !== false;
  return useCallback(
    (videoId: string, coverUrl?: string | null, thumb?: CoverThumb) =>
      getCoverUrl(videoId, coverUrl, thumb, proxyThumb),
    [proxyThumb],
  );
}

/**
 * 图片区、游戏区等走 /api/cover 的 URL，受同一开关控制。
 */
export function useImageProxyUrl() {
  const cfg = useSiteConfig();
  const proxyThumb = cfg?.coverProxyThumbEnabled !== false;
  return useCallback(
    (imageUrl: string, thumb?: ImageProxyThumb) => getImageProxyUrl(imageUrl, thumb, proxyThumb),
    [proxyThumb],
  );
}
