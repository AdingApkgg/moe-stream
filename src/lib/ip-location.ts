import { memGet, memSet } from "@/lib/memory-cache";
import { IPv4, IPv6, loadContentFromFile, newWithBuffer } from "ip2region.js";
import path from "path";

interface IpLocation {
  country?: string;
  province?: string;
  city?: string;
  isp?: string;
  countryCode?: string;
}

interface Ip2RegionSearcher {
  search(ip: string): Promise<string>;
  close(): void;
}

const CACHE_TTL_MS = 60 * 60 * 24 * 1000;

let ip2regionV4Searcher: Ip2RegionSearcher | null = null;
let ip2regionV6Searcher: Ip2RegionSearcher | null = null;
let ip2regionV4Initialized = false;
let ip2regionV6Initialized = false;

function isIPv6(ip: string): boolean {
  return ip.includes(":");
}

function getIp2RegionV4Searcher(): Ip2RegionSearcher | null {
  if (ip2regionV4Initialized) {
    return ip2regionV4Searcher;
  }

  ip2regionV4Initialized = true;

  try {
    const dbPath = path.join(process.cwd(), "data", "ip2region_v4.xdb");
    const cBuffer = loadContentFromFile(dbPath);
    ip2regionV4Searcher = newWithBuffer(IPv4, cBuffer) as unknown as Ip2RegionSearcher;
    console.log("[IP2Region] IPv4 searcher initialized");
    return ip2regionV4Searcher;
  } catch (error) {
    console.error("[IP2Region] Failed to initialize IPv4 searcher:", error);
    return null;
  }
}

function getIp2RegionV6Searcher(): Ip2RegionSearcher | null {
  if (ip2regionV6Initialized) {
    return ip2regionV6Searcher;
  }

  ip2regionV6Initialized = true;

  try {
    const dbPath = path.join(process.cwd(), "data", "ip2region_v6.xdb");
    const cBuffer = loadContentFromFile(dbPath);
    ip2regionV6Searcher = newWithBuffer(IPv6, cBuffer) as unknown as Ip2RegionSearcher;
    console.log("[IP2Region] IPv6 searcher initialized");
    return ip2regionV6Searcher;
  } catch (error) {
    console.error("[IP2Region] Failed to initialize IPv6 searcher:", error);
    return null;
  }
}

function getIp2RegionSearcher(ip: string): Ip2RegionSearcher | null {
  return isIPv6(ip) ? getIp2RegionV6Searcher() : getIp2RegionV4Searcher();
}

/**
 * 解析 ip2region 返回的 region 字符串
 * 格式: "中国|广东省|湛江市|移动|CN" (国家|省份|城市|ISP|国家代码)
 */
function parseRegion(region: string): IpLocation {
  const parts = region.split("|");

  return {
    country: parts[0] && parts[0] !== "0" ? parts[0] : undefined,
    province: parts[1] && parts[1] !== "0" ? parts[1] : undefined,
    city: parts[2] && parts[2] !== "0" ? parts[2] : undefined,
    isp: parts[3] && parts[3] !== "0" ? parts[3] : undefined,
    countryCode: parts[4] && parts[4] !== "0" ? parts[4] : undefined,
  };
}

function isPrivateIp(ip: string): boolean {
  if (isIPv6(ip)) {
    if (ip === "::1") return true;
    if (ip.toLowerCase().startsWith("fe80:")) return true;
    if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true;
    const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4Mapped) {
      return isPrivateIp(v4Mapped[1]);
    }
    return false;
  }

  if (ip === "127.0.0.1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  const match = ip.match(/^172\.(\d+)\./);
  if (match) {
    const octet = Number(match[1]);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}

function formatLocation(location: IpLocation | null): string | null {
  if (!location) return null;
  const parts = [location.country, location.province, location.city].filter(Boolean);
  const uniqueParts = parts.filter((part, index, arr) => arr.indexOf(part) === index);
  return uniqueParts.length > 0 ? uniqueParts.join(" ") : null;
}

/**
 * 使用 ip2region 官方离线数据库获取 IP 地理位置
 * 同时支持 IPv4 和 IPv6
 */
export async function getIpLocation(ip: string | null): Promise<string | null> {
  if (!ip) return null;

  if (process.env.NODE_ENV === "development" && isPrivateIp(ip)) {
    ip = isIPv6(ip) ? "2400:3200::1" : "1.1.1.1";
  }

  if (isPrivateIp(ip)) return null;

  const cacheKey = `ip-location:${ip}`;
  const cached = memGet<IpLocation>(cacheKey);
  if (cached !== undefined) {
    return formatLocation(cached);
  }

  const ipVersion = isIPv6(ip) ? "IPv6" : "IPv4";

  try {
    const searcher = getIp2RegionSearcher(ip);

    if (!searcher) {
      console.log(`[IP Location] ip2region ${ipVersion} not available, falling back to API for ${ip}`);
      return await getIpLocationFromApi(ip, cacheKey);
    }

    const region = await searcher.search(ip);

    if (!region) {
      console.log(`[IP Location] ip2region returned empty, falling back to API for ${ip}`);
      return await getIpLocationFromApi(ip, cacheKey);
    }

    const location = parseRegion(region);

    if (!location.country && !location.province && !location.city) {
      console.log(`[IP Location] ip2region result empty, falling back to API for ${ip}`);
      return await getIpLocationFromApi(ip, cacheKey);
    }

    console.log(`[IP Location] ip2region ${ipVersion} result for ${ip}:`, formatLocation(location));
    memSet(cacheKey, location, CACHE_TTL_MS);
    return formatLocation(location);
  } catch (error) {
    console.error(`[IP Location] Error for ${ip}:`, error);
    return await getIpLocationFromApi(ip, cacheKey);
  }
}

async function getIpLocationFromApi(ip: string, cacheKey: string): Promise<string | null> {
  try {
    console.log(`[IP Location] Fetching from ip-api.com for ${ip}`);
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,isp,query&lang=zh-CN`,
      { headers: { "User-Agent": "moe-stream/1.0" } },
    );

    if (!response.ok) {
      console.error(`[IP Location] ip-api.com returned ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      status: "success" | "fail";
      message?: string;
      country?: string;
      regionName?: string;
      city?: string;
      isp?: string;
    };

    if (data.status !== "success") {
      console.error(`[IP Location] ip-api.com error:`, data.message);
      return null;
    }

    const location: IpLocation = {
      country: data.country,
      province: data.regionName,
      city: data.city,
      isp: data.isp,
    };

    const formatted = formatLocation(location);
    console.log(`[IP Location] ip-api.com result for ${ip}:`, formatted);
    memSet(cacheKey, location, CACHE_TTL_MS);
    return formatted;
  } catch (error) {
    console.error(`[IP Location] ip-api.com error for ${ip}:`, error);
    return null;
  }
}
