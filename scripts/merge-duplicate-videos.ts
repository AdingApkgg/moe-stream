#!/usr/bin/env npx tsx
/**
 * 合并重复视频（按 videoUrl 去重）
 *
 * 对同一 videoUrl 的多条视频：保留一条（优先保留先创建的），
 * 将其余条目的关联（合集、收藏、评论等）归并到保留条，再删除重复视频。
 *
 * 运行方式: npx tsx scripts/merge-duplicate-videos.ts
 * 可选参数:
 *   --dry-run    仅统计并列出将合并的组，不写库
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.development" });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: ".env.production" });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");

async function mergeDuplicateVideos() {
  console.log("查找重复视频（按 videoUrl）...\n");

  const all = await prisma.video.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      createdAt: true,
    },
  });

  const byUrl = new Map<string, typeof all>();
  for (const v of all) {
    if (!byUrl.has(v.videoUrl)) byUrl.set(v.videoUrl, []);
    byUrl.get(v.videoUrl)!.push(v);
  }

  const duplicateGroups = [...byUrl.entries()].filter(([, list]) => list.length > 1);
  if (duplicateGroups.length === 0) {
    console.log("未发现重复 videoUrl，无需合并。");
    return;
  }

  const totalDupes = duplicateGroups.reduce((sum, [, list]) => sum + list.length - 1, 0);
  console.log(`共 ${duplicateGroups.length} 组重复（涉及 ${totalDupes} 条可删除）\n`);

  if (DRY_RUN) {
    for (const [url, list] of duplicateGroups) {
      const [keep, ...dupes] = list;
      console.log(`保留: ${keep.id} "${keep.title.slice(0, 50)}..."`);
      console.log(`  合并: ${dupes.map((d) => d.id).join(", ")}`);
      console.log(`  URL: ${url.slice(0, 70)}...`);
      console.log("");
    }
    console.log("（--dry-run 未写库，去掉该参数后执行将真正合并）");
    return;
  }

  let deletedCount = 0;

  for (const [, list] of duplicateGroups) {
    const [canonical, ...duplicates] = list;
    const canonicalId = canonical.id;

    for (const dup of duplicates) {
      const dupId = dup.id;
      try {
        // 1) SeriesEpisode: 若合集中已有 canonical，则删除重复的剧集行；否则改为指向 canonical
        const dupEpisodes = await prisma.seriesEpisode.findMany({
          where: { videoId: dupId },
          select: { id: true, seriesId: true },
        });
        for (const ep of dupEpisodes) {
          const existing = await prisma.seriesEpisode.findUnique({
            where: { seriesId_videoId: { seriesId: ep.seriesId, videoId: canonicalId } },
          });
          if (existing) {
            await prisma.seriesEpisode.delete({ where: { id: ep.id } });
          } else {
            await prisma.seriesEpisode.update({
              where: { id: ep.id },
              data: { videoId: canonicalId },
            });
          }
        }

        // 2) Favorite / Like / Dislike / Confused: 先删会冲突的，再统一改为 canonical
        const existingFav = await prisma.favorite.findMany({
          where: { videoId: canonicalId },
          select: { userId: true },
        });
        const favUserIds = new Set(existingFav.map((r) => r.userId));
        await prisma.favorite.deleteMany({
          where: { videoId: dupId, userId: { in: [...favUserIds] } },
        });
        await prisma.favorite.updateMany({
          where: { videoId: dupId },
          data: { videoId: canonicalId },
        });

        const likeUserIds = new Set(
          (await prisma.like.findMany({ where: { videoId: canonicalId }, select: { userId: true } })).map((r) => r.userId),
        );
        await prisma.like.deleteMany({ where: { videoId: dupId, userId: { in: [...likeUserIds] } } });
        await prisma.like.updateMany({ where: { videoId: dupId }, data: { videoId: canonicalId } });

        const dislikeUserIds = new Set(
          (await prisma.dislike.findMany({ where: { videoId: canonicalId }, select: { userId: true } })).map((r) => r.userId),
        );
        await prisma.dislike.deleteMany({ where: { videoId: dupId, userId: { in: [...dislikeUserIds] } } });
        await prisma.dislike.updateMany({ where: { videoId: dupId }, data: { videoId: canonicalId } });

        const confusedUserIds = new Set(
          (await prisma.confused.findMany({ where: { videoId: canonicalId }, select: { userId: true } })).map((r) => r.userId),
        );
        await prisma.confused.deleteMany({ where: { videoId: dupId, userId: { in: [...confusedUserIds] } } });
        await prisma.confused.updateMany({ where: { videoId: dupId }, data: { videoId: canonicalId } });

        // 3) WatchHistory: 同用户只保留一条（保留 canonical 的或进度更大的）
        const dupHistories = await prisma.watchHistory.findMany({
          where: { videoId: dupId },
          select: { id: true, userId: true, progress: true },
        });
        for (const h of dupHistories) {
          const existing = await prisma.watchHistory.findUnique({
            where: { userId_videoId: { userId: h.userId, videoId: canonicalId } },
          });
          if (existing) {
            if (h.progress > (existing.progress ?? 0)) {
              await prisma.watchHistory.update({
                where: { id: existing.id },
                data: { progress: h.progress },
              });
            }
            await prisma.watchHistory.delete({ where: { id: h.id } });
          } else {
            await prisma.watchHistory.update({
              where: { id: h.id },
              data: { videoId: canonicalId },
            });
          }
        }

        // 4) PlaylistItem: 同播放列表只保留一条
        const dupItems = await prisma.playlistItem.findMany({
          where: { videoId: dupId },
          select: { id: true, playlistId: true },
        });
        for (const item of dupItems) {
          const existing = await prisma.playlistItem.findUnique({
            where: { playlistId_videoId: { playlistId: item.playlistId, videoId: canonicalId } },
          });
          if (existing) {
            await prisma.playlistItem.delete({ where: { id: item.id } });
          } else {
            await prisma.playlistItem.update({
              where: { id: item.id },
              data: { videoId: canonicalId },
            });
          }
        }

        // 5) Comment: 直接改 videoId
        await prisma.comment.updateMany({
          where: { videoId: dupId },
          data: { videoId: canonicalId },
        });

        // 6) TagOnVideo: 重复条目的标签不合并，直接删（保留 canonical 的标签）
        await prisma.tagOnVideo.deleteMany({ where: { videoId: dupId } });

        // 7) 删除重复视频
        await prisma.video.delete({ where: { id: dupId } });

        deletedCount++;
        console.log(`✓ ${dupId} → ${canonicalId} (${dup.title.slice(0, 40)}...)`);
      } catch (e) {
        console.error(`✗ ${dupId} 合并失败:`, e);
      }
    }
  }

  console.log(`\n合并完成：${deletedCount} 条重复已并入对应保留项并删除。`);
}

mergeDuplicateVideos()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
