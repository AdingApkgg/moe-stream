export interface StickerPresetPack {
  id: string;
  name: string;
  slug: string;
  source: string;
  description: string;
  preview?: string;
  fetchConfig:
    | { type: "waline"; baseUrl: string; folder: string }
    | { type: "owo"; jsonUrl: string; imageBaseUrl: string }
    | { type: "artalk"; jsonUrl: string };
}

export const STICKER_PRESETS: StickerPresetPack[] = [
  // ==================== Waline Official ====================
  {
    id: "waline-bilibili",
    name: "BiliBili",
    slug: "bilibili",
    source: "Waline",
    description: "哔哩哔哩小电视表情，50 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/bilibili/bb_cute.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "bilibili",
    },
  },
  {
    id: "waline-bmoji",
    name: "B站小黄脸",
    slug: "bmoji",
    source: "Waline",
    description: "B站黄色表情包，70+ 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/bmoji/bmoji_doge.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "bmoji",
    },
  },
  {
    id: "waline-qq",
    name: "QQ 表情",
    slug: "qq",
    source: "Waline",
    description: "经典 QQ 表情包 (GIF)，200+ 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/qq/qq_grin.gif",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "qq",
    },
  },
  {
    id: "waline-tieba",
    name: "贴吧",
    slug: "tieba",
    source: "Waline",
    description: "百度贴吧表情包，50+ 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/tieba/tieba_antic.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "tieba",
    },
  },
  {
    id: "waline-weibo",
    name: "微博",
    slug: "weibo",
    source: "Waline",
    description: "微博表情包，80+ 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/weibo/weibo_doge.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "weibo",
    },
  },
  {
    id: "waline-alus",
    name: "阿鲁",
    slug: "alus",
    source: "Waline",
    description: "阿鲁表情包，50+ 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/alus/alus_happy.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "alus",
    },
  },
  {
    id: "waline-soul",
    name: "Soul 表情",
    slug: "soul-emoji",
    source: "Waline",
    description: "Soul App 表情包，30+ 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/soul-emoji/soul_squint_smile.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "soul-emoji",
    },
  },
  {
    id: "waline-tw-emoji",
    name: "Twemoji 表情",
    slug: "tw-emoji",
    source: "Waline",
    description: "Twitter Emoji 表情，109 个",
    preview: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0/tw-emoji/1f600.png",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "tw-emoji",
    },
  },
  {
    id: "waline-tw-people",
    name: "Twemoji 人物",
    slug: "tw-people",
    source: "Waline",
    description: "Twitter Emoji 人物系列，1385 个",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "tw-people",
    },
  },
  {
    id: "waline-tw-food",
    name: "Twemoji 食物",
    slug: "tw-food",
    source: "Waline",
    description: "Twitter Emoji 食物系列，111 个",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "tw-food",
    },
  },
  {
    id: "waline-tw-natural",
    name: "Twemoji 自然",
    slug: "tw-natural",
    source: "Waline",
    description: "Twitter Emoji 自然系列，139 个",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "tw-natural",
    },
  },
  {
    id: "waline-tw-sport",
    name: "Twemoji 运动",
    slug: "tw-sport",
    source: "Waline",
    description: "Twitter Emoji 运动系列，239 个",
    fetchConfig: {
      type: "waline",
      baseUrl: "https://cdn.jsdelivr.net/npm/@waline/emojis@1.2.0",
      folder: "tw-sport",
    },
  },

  // ==================== Twikoo / OwO ====================
  {
    id: "twikoo-blobcat",
    name: "Blobcat",
    slug: "blobcat",
    source: "Twikoo",
    description: "可爱猫咪 Blob 表情包，60+ 个",
    preview: "https://cdn.jsdelivr.net/gh/infinitesum/Twikoo-emoji@master/Blob/ablobcatheart.png",
    fetchConfig: {
      type: "owo",
      jsonUrl: "https://cdn.jsdelivr.net/gh/infinitesum/Twikoo-emoji@master/blobcat.json",
      imageBaseUrl: "https://cdn.jsdelivr.net/gh/infinitesum/Twikoo-emoji@master/Blob",
    },
  },
  {
    id: "twikoo-capoo",
    name: "Capoo 猫",
    slug: "capoo",
    source: "Twikoo",
    description: "虫虫猫 Capoo 表情包",
    fetchConfig: {
      type: "owo",
      jsonUrl: "https://cdn.jsdelivr.net/gh/infinitesum/Twikoo-emoji@master/capoo.json",
      imageBaseUrl: "https://cdn.jsdelivr.net/gh/infinitesum/Twikoo-emoji@master/capoo",
    },
  },
];

export interface WalineInfoJson {
  name: string;
  prefix: string;
  type: string;
  icon: string;
  items: string[];
}

export interface OwoContainer {
  text: string;
  icon: string;
}

export interface OwoJson {
  [packName: string]: {
    type: string;
    container: OwoContainer[];
  };
}

/**
 * Resolve a preset into a list of { url, name } items for import.
 */
export async function resolvePresetItems(preset: StickerPresetPack): Promise<{ name: string; url: string }[]> {
  const config = preset.fetchConfig;

  if (config.type === "waline") {
    const infoUrl = `${config.baseUrl}/${config.folder}/info.json`;
    const res = await fetch(infoUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Failed to fetch info.json: HTTP ${res.status}`);
    const info: WalineInfoJson = await res.json();

    return info.items.map((item) => ({
      name: item.replace(/_/g, " "),
      url: `${config.baseUrl}/${config.folder}/${info.prefix}${item}.${info.type}`,
    }));
  }

  if (config.type === "owo") {
    const res = await fetch(config.jsonUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Failed to fetch OwO JSON: HTTP ${res.status}`);
    const data: OwoJson = await res.json();

    const items: { name: string; url: string }[] = [];
    for (const packName of Object.keys(data)) {
      const pack = data[packName];
      if (pack.type !== "image") continue;
      for (const entry of pack.container) {
        const iconStr = typeof entry.icon === "string" ? entry.icon.trim() : "";
        const imgMatch = iconStr.match(/src=["']([^"']+)["']/);
        if (imgMatch) {
          items.push({ name: entry.text, url: imgMatch[1] });
        } else {
          items.push({
            name: entry.text,
            url: `${config.imageBaseUrl}/${packName}_${entry.text}.png`,
          });
        }
      }
    }
    return items;
  }

  if (config.type === "artalk") {
    const res = await fetch(config.jsonUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Failed to fetch Artalk JSON: HTTP ${res.status}`);
    const data = (await res.json()) as Array<{
      name: string;
      type: string;
      items: Array<{ key: string; val: string }>;
    }>;

    const items: { name: string; url: string }[] = [];
    for (const group of data) {
      if (group.type !== "image") continue;
      for (const entry of group.items) {
        items.push({ name: entry.key, url: entry.val });
      }
    }
    return items;
  }

  throw new Error(`Unknown preset type`);
}

export interface ResolvedPack {
  packName: string;
  items: { name: string; url: string }[];
}

/**
 * Auto-detect format from a user-provided URL and resolve sticker items.
 * Returns an array of packs — one JSON source may contain multiple groups.
 *
 * Supported URL patterns:
 * - Waline: ends with info.json, or a folder URL containing info.json
 * - OwO JSON (Twikoo/Valine): .json file with { packName: { type, container } }
 * - Artalk JSON: .json array with [{ name, type, items: [{key, val}] }]
 */
export async function resolveExternalUrl(rawUrl: string): Promise<ResolvedPack[]> {
  const url = rawUrl.trim().replace(/\/+$/, "");

  // --- Try Waline info.json ---
  const infoJsonUrl = url.endsWith("/info.json") ? url : `${url}/info.json`;
  try {
    const res = await fetch(infoJsonUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const info: WalineInfoJson = await res.json();
      if (info.prefix && info.items && Array.isArray(info.items)) {
        const baseUrl = infoJsonUrl.replace(/\/info\.json$/, "");
        return [
          {
            packName: info.name || "Waline Pack",
            items: info.items.map((item) => ({
              name: item.replace(/_/g, " "),
              url: `${baseUrl}/${info.prefix}${item}.${info.type}`,
            })),
          },
        ];
      }
    }
  } catch {
    // not Waline format, continue
  }

  // --- Fetch raw JSON for OwO / Artalk detection ---
  const jsonRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!jsonRes.ok) throw new Error(`无法访问 URL: HTTP ${jsonRes.status}`);

  const text = await jsonRes.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("URL 返回的内容不是有效的 JSON");
  }

  // --- Artalk format: top-level array ---
  if (Array.isArray(data)) {
    const packs: ResolvedPack[] = [];
    for (const group of data as Array<Record<string, unknown>>) {
      if (group.type !== "image" || !Array.isArray(group.items)) continue;
      const groupName = typeof group.name === "string" ? group.name : `Artalk Pack ${packs.length + 1}`;
      const items: { name: string; url: string }[] = [];
      for (const entry of group.items as Array<{ key?: string; val?: string }>) {
        if (entry.val && typeof entry.val === "string" && entry.val.startsWith("http")) {
          items.push({ name: (entry.key as string) || "sticker", url: entry.val });
        }
      }
      if (items.length > 0) packs.push({ packName: groupName, items });
    }
    if (packs.length > 0) return packs;
  }

  // --- OwO format: { packName: { type, container: [...] } } ---
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const owoData = data as OwoJson;
    const packs: ResolvedPack[] = [];
    const baseUrl = url.replace(/\/[^/]+\.json$/, "");

    for (const key of Object.keys(owoData)) {
      const pack = owoData[key];
      if (!pack || typeof pack !== "object") continue;
      if (pack.type !== "image" || !Array.isArray(pack.container)) continue;

      const items: { name: string; url: string }[] = [];
      for (const entry of pack.container) {
        if (!entry.text) continue;
        const iconStr = typeof entry.icon === "string" ? entry.icon.trim() : "";
        const imgMatch = iconStr.match(/src=["']([^"']+)["']/);
        if (imgMatch) {
          items.push({ name: entry.text, url: imgMatch[1] });
        } else {
          items.push({
            name: entry.text,
            url: `${baseUrl}/${key}/${key}_${entry.text}.png`,
          });
        }
      }
      if (items.length > 0) packs.push({ packName: key, items });
    }
    if (packs.length > 0) return packs;

    // Maybe it's a Waline info.json directly fetched (not ending in /info.json)
    const maybeInfo = data as Record<string, unknown>;
    if (maybeInfo.prefix && maybeInfo.items && Array.isArray(maybeInfo.items)) {
      const info = maybeInfo as unknown as WalineInfoJson;
      const baseDir = url.replace(/\/[^/]+$/, "");
      return [
        {
          packName: (info.name as string) || "Waline Pack",
          items: (info.items as string[]).map((item) => ({
            name: item.replace(/_/g, " "),
            url: `${baseDir}/${info.prefix}${item}.${info.type}`,
          })),
        },
      ];
    }
  }

  throw new Error("无法识别表情包格式，请确认链接指向 Waline、OwO 或 Artalk 格式的数据");
}
