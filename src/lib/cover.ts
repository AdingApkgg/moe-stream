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
