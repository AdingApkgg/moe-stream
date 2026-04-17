import { Meilisearch } from "meilisearch";

let _client: Meilisearch | undefined;

/** 懒加载单例：避免 import 侧在缺少环境变量时立即抛错（首次查询时再 fail-fast）。 */
export function getMeili(): Meilisearch {
  if (!_client) {
    const url = process.env.MEILISEARCH_URL;
    if (!url) {
      throw new Error("MEILISEARCH_URL 未配置");
    }
    _client = new Meilisearch({ host: url, apiKey: process.env.MEILISEARCH_MASTER_KEY });
  }
  return _client;
}

/** 与官方 SDK 用法一致：`meili.index(INDEX.video)`
 *  注意：getter（如 `tasks`）访问 Meilisearch 内部私有字段，必须以真实实例为 receiver， */
/*   否则会触发 "Cannot read private member" 错误。 */
export const meili = new Proxy({} as Meilisearch, {
  get(_target, prop) {
    const c = getMeili();
    const v = Reflect.get(c, prop, c) as unknown;
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});

export const INDEX = {
  video: "videos",
  game: "games",
  image: "imagePosts",
  tag: "tags",
  user: "users",
} as const;

export type SearchIndexKey = keyof typeof INDEX;

export function safeSync(p: Promise<unknown>): void {
  void p.catch((e) => {
    console.error("[meili sync]", e);
  });
}
