/**
 * 封面 URL 工具函数
 */

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export interface CoverThumb {
  w: number;
  q?: number;
}

function appendThumbParams(url: string, thumb?: CoverThumb): string {
  if (!thumb) return url;
  return `${url}${url.includes("?") ? "&" : "?"}w=${thumb.w}&h=${thumb.w}&q=${thumb.q ?? 60}`;
}

/**
 * 获取视频封面 URL（相对路径，用于前端组件）
 * 如果有 coverUrl 则返回缓存代理 URL，否则返回自动生成的封面 URL
 * 可选 thumb 参数用于请求缩略图。
 * @param coverProxyThumbEnabled 与后台「封面代理缩略图」一致；为 false 时不附加 ?w/h/q
 */
export function getCoverUrl(
  videoId: string,
  coverUrl?: string | null,
  thumb?: CoverThumb,
  coverProxyThumbEnabled = true,
): string {
  const t = coverProxyThumbEnabled ? thumb : undefined;
  if (coverUrl) {
    if (coverUrl.startsWith("/uploads/")) {
      if (t) {
        return appendThumbParams(`/api/cover/${encodeURIComponent(coverUrl)}`, t);
      }
      return coverUrl;
    }
    return appendThumbParams(`/api/cover/${encodeURIComponent(coverUrl)}`, t);
  }
  return appendThumbParams(`/api/cover/video/${videoId}`, t);
}

/**
 * 获取视频封面完整 URL（用于 OG、JSON-LD 等需要完整 URL 的场景）
 */
export function getCoverFullUrl(videoId: string, coverUrl?: string | null): string {
  if (coverUrl) {
    if (coverUrl.startsWith("/")) {
      return `${BASE_URL}${coverUrl}`;
    }
    if (coverUrl.startsWith("http")) {
      return coverUrl;
    }
  }
  return `${BASE_URL}/api/cover/video/${videoId}`;
}

/**
 * 获取原始封面 URL（不经过代理）
 */
export function getOriginalCoverUrl(coverUrl?: string | null): string | null {
  return coverUrl || null;
}

/**
 * 默认封面 URL
 */
export const DEFAULT_COVER_URL = "/default-cover.jpg";

/** 图片 / 游戏封面等走 /api/cover 时的缩略参数（与视频列表 CoverThumb 区分：可单独指定 h） */
export interface ImageProxyThumb {
  w: number;
  h?: number;
  q?: number;
}

function appendImageThumbQuery(base: string, thumb: ImageProxyThumb): string {
  const q = thumb.q ?? 60;
  const h = thumb.h ?? thumb.w;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}w=${thumb.w}&h=${h}&q=${q}`;
}

/**
 * 图片帖、游戏封面等外链或本地图走 /api/cover 代理时的 URL。
 * 与 `getCoverUrl` 相同受后台「封面代理缩略图」开关控制。
 */
export function getImageProxyUrl(imageUrl: string, thumb?: ImageProxyThumb, coverProxyThumbEnabled = true): string {
  const useThumb = coverProxyThumbEnabled && thumb != null;
  if (!useThumb) {
    if (imageUrl.startsWith("/uploads/")) return imageUrl;
    return `/api/cover/${encodeURIComponent(imageUrl)}`;
  }
  const base = `/api/cover/${encodeURIComponent(imageUrl)}`;
  return appendImageThumbQuery(base, thumb);
}
