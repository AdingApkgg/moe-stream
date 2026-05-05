// 安全解析用户填写的 website：可能是 "example.com" 也可能是非法字符串
export function parseWebsite(raw: string): { href: string; hostname: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const href = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
  try {
    const url = new URL(href);
    return { href: url.toString(), hostname: url.hostname };
  } catch {
    return null;
  }
}

export type Zone = "all" | "video" | "image" | "game";
export type VideoTab = "uploads" | "history" | "favorites" | "liked";
export type GameTab = "uploads" | "history" | "favorites" | "liked";
export type ImageTab = "posts" | "history" | "favorites" | "liked";

export const ZONE_DEFAULT_TAB: Record<Exclude<Zone, "all">, string> = {
  video: "uploads",
  game: "uploads",
  image: "posts",
};

export function getDefaultTab(zone: Zone): string {
  if (zone === "all") return "";
  return ZONE_DEFAULT_TAB[zone];
}
