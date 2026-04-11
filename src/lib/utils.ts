import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 判断 URL 是否为外部链接，如果是则返回中转页 URL，否则返回原始 URL。
 * 以 `/` 开头的相对路径视为站内链接，不走中转。
 * 绝对 http(s) URL 走中转。
 */
export function getRedirectUrl(url: string): string {
  if (!url || url.startsWith("/") || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
    if (typeof window !== "undefined" && parsed.hostname === window.location.hostname) return url;
    return `/redirect?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
