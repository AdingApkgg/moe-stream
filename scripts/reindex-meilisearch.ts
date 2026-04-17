/**
 * Meilisearch 索引初始化与全量同步脚本。
 *
 * 用法:
 *   pnpm meili:init      # 仅 ensureIndexes（创建索引 + settings）
 *   pnpm meili:reindex   # ensureIndexes + 全量文档（会先清空各索引文档）
 *   NODE_ENV=production DOTENV_CONFIG_PATH=.env.production pnpm exec tsx --require dotenv/config scripts/reindex-meilisearch.ts
 *
 *   --init-only          仅初始化 settings，不写文档
 *   --only video,tag     只重建指定类型（video|game|image|tag|user）
 */
import path from "node:path";
import { config } from "dotenv";

const envFile = process.env.DOTENV_CONFIG_PATH ?? ".env.development";
config({ path: path.resolve(process.cwd(), envFile) });

import { prisma } from "../src/lib/prisma";
import { meili, INDEX } from "../src/lib/meilisearch";
import { ensureIndexes } from "../src/lib/search-index-config";
import { syncVideo, syncGame, syncImagePost, syncTag, syncUser } from "../src/lib/search-sync";

const BATCH = 1000;

type Only = "video" | "game" | "image" | "tag" | "user";

function parseArgs() {
  const args = process.argv.slice(2);
  const initOnly = args.includes("--init-only");
  let only: Only[] | null = null;
  const idx = args.findIndex((a) => a === "--only");
  if (idx >= 0) {
    const raw = args[idx + 1];
    if (raw) {
      only = raw.split(",").map((s) => s.trim()) as Only[];
      for (const o of only) {
        if (!["video", "game", "image", "tag", "user"].includes(o)) {
          throw new Error(`无效的 --only 值: ${o}`);
        }
      }
    }
  }
  return { initOnly, only };
}

async function flushIndex(uid: string): Promise<void> {
  const t = await meili.index(uid).deleteAllDocuments();
  await meili.tasks.waitForTask(t.taskUid);
}

async function reindexVideos(): Promise<void> {
  await flushIndex(INDEX.video);
  let skip = 0;
  for (;;) {
    const rows = await prisma.video.findMany({
      take: BATCH,
      skip,
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      await syncVideo(r.id);
    }
    skip += BATCH;
    if (rows.length < BATCH) break;
  }
}

async function reindexGames(): Promise<void> {
  await flushIndex(INDEX.game);
  let skip = 0;
  for (;;) {
    const rows = await prisma.game.findMany({
      take: BATCH,
      skip,
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      await syncGame(r.id);
    }
    skip += BATCH;
    if (rows.length < BATCH) break;
  }
}

async function reindexImagePosts(): Promise<void> {
  await flushIndex(INDEX.image);
  let skip = 0;
  for (;;) {
    const rows = await prisma.imagePost.findMany({
      take: BATCH,
      skip,
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      await syncImagePost(r.id);
    }
    skip += BATCH;
    if (rows.length < BATCH) break;
  }
}

async function reindexTags(): Promise<void> {
  await flushIndex(INDEX.tag);
  let skip = 0;
  for (;;) {
    const rows = await prisma.tag.findMany({
      take: BATCH,
      skip,
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      await syncTag(r.id);
    }
    skip += BATCH;
    if (rows.length < BATCH) break;
  }
}

async function reindexUsers(): Promise<void> {
  await flushIndex(INDEX.user);
  let skip = 0;
  for (;;) {
    const rows = await prisma.user.findMany({
      take: BATCH,
      skip,
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      await syncUser(r.id);
    }
    skip += BATCH;
    if (rows.length < BATCH) break;
  }
}

async function main() {
  const { initOnly, only } = parseArgs();
  console.log("[meili] ensureIndexes…");
  await ensureIndexes();
  if (initOnly) {
    console.log("[meili] --init-only，跳过文档写入");
    return;
  }

  const types: Only[] = only?.length ? only : ["video", "game", "image", "tag", "user"];
  for (const t of types) {
    console.log(`[meili] 全量同步: ${t}…`);
    switch (t) {
      case "video":
        await reindexVideos();
        break;
      case "game":
        await reindexGames();
        break;
      case "image":
        await reindexImagePosts();
        break;
      case "tag":
        await reindexTags();
        break;
      case "user":
        await reindexUsers();
        break;
      default:
        break;
    }
  }
  console.log("[meili] 完成");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
