import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface RedirectOptions {
  enabled?: boolean;
  whitelist?: string[];
}

function isWhitelistedDomain(hostname: string, whitelist: string[]): boolean {
  const h = hostname.toLowerCase();
  for (const domain of whitelist) {
    const d = domain.toLowerCase();
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

/**
 * 判断 URL 是否为外部链接，如果是则返回中转页 URL，否则返回原始 URL。
 * 以 `/` 开头的相对路径视为站内链接，不走中转。
 * 绝对 http(s) URL 走中转。
 *
 * @param options.enabled  中转功能是否启用，false 时所有外链直接放行
 * @param options.whitelist 白名单域名列表，匹配的域名（含子域名）不走中转
 */
export function getRedirectUrl(url: string, options?: RedirectOptions): string {
  if (!url || url.startsWith("/") || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
    if (typeof window !== "undefined" && parsed.hostname === window.location.hostname) return url;
    if (options?.enabled === false) return url;
    if (options?.whitelist?.length && isWhitelistedDomain(parsed.hostname, options.whitelist)) return url;
    return `/redirect?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
