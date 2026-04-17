import type { Settings } from "meilisearch";
import { meili, INDEX, type SearchIndexKey } from "@/lib/meilisearch";

const VIDEO_SETTINGS: Settings = {
  searchableAttributes: [
    "title",
    "description",
    "tagNames",
    "uploaderNickname",
    "uploaderUsername",
    "author",
    "keywords",
  ],
  filterableAttributes: ["status", "tagSlugs", "tagIds", "uploaderId", "isNsfw", "createdAtTs"],
  sortableAttributes: ["createdAtTs", "views", "likes"],
};

const GAME_SETTINGS: Settings = {
  searchableAttributes: [
    "title",
    "aliases",
    "originalName",
    "description",
    "tagNames",
    "originalAuthor",
    "uploaderNickname",
    "uploaderUsername",
    "keywords",
  ],
  filterableAttributes: ["status", "tagSlugs", "tagIds", "gameType", "isFree", "isNsfw", "createdAtTs"],
  sortableAttributes: ["createdAtTs", "views", "downloads", "likes"],
};

const IMAGE_SETTINGS: Settings = {
  searchableAttributes: ["title", "description", "tagNames", "uploaderNickname", "uploaderUsername"],
  filterableAttributes: ["status", "tagSlugs", "tagIds", "isNsfw", "createdAtTs"],
  sortableAttributes: ["createdAtTs", "views", "likes"],
};

const TAG_SETTINGS: Settings = {
  searchableAttributes: ["name", "slug", "aliasNames", "description"],
  filterableAttributes: ["categoryId", "videoCount", "gameCount", "imagePostCount"],
  sortableAttributes: ["videoCount", "gameCount", "imagePostCount", "name"],
};

const USER_SETTINGS: Settings = {
  searchableAttributes: ["nickname", "username", "bio"],
  filterableAttributes: ["isBanned", "role"],
  sortableAttributes: ["videoCount"],
};

const SETTINGS_BY_UID: Record<(typeof INDEX)[SearchIndexKey], Settings> = {
  [INDEX.video]: VIDEO_SETTINGS,
  [INDEX.game]: GAME_SETTINGS,
  [INDEX.image]: IMAGE_SETTINGS,
  [INDEX.tag]: TAG_SETTINGS,
  [INDEX.user]: USER_SETTINGS,
};

/** Meilisearch 过滤值中的引号与反斜杠转义 */
export function meiliQuoteFilterValue(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * 创建缺失索引并更新 settings（幂等）。
 * 生产首次部署或 schema 变更后执行 `pnpm meili:init`。
 */
export async function ensureIndexes(): Promise<void> {
  const client = meili;
  const { results } = await client.getIndexes({ limit: 100 });
  const existing = new Set(results.map((i: { uid: string }) => i.uid));

  for (const uid of Object.values(INDEX)) {
    if (!existing.has(uid)) {
      const created = await client.createIndex(uid, { primaryKey: "id" });
      await client.tasks.waitForTask(created.taskUid);
    }
    const task = await client.index(uid).updateSettings(SETTINGS_BY_UID[uid]);
    await client.tasks.waitForTask(task.taskUid);
  }
}
