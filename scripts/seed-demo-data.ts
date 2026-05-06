/**
 * 给当前管理员账号 + 各分区造一批"展示态"测试数据，让最近做的 UI 效果
 * (NEW 徽章 / 进度条 / 已看完角标 / 收藏 fill 态) 都能在浏览器里直观看到。
 *
 * 不会插入新内容，只会：
 *   1. 把若干已发布的视频/图片/游戏 createdAt 拨到最近 24h 内 → 触发 NEW 徽章
 *   2. 给指定用户对若干视频造 WatchHistory：
 *        - 5 个视频部分进度 (15% / 35% / 60% / 80% 进度条)
 *        - 3 个视频接近看完 (97%) → 触发"已看完"角标 + 灰度遮罩
 *   3. 给指定用户对若干视频/图片/游戏插入 Favorite 记录 → 心形按钮 fill
 *
 * 用法:  pnpm tsx scripts/seed-demo-data.ts [email]
 *   email 默认 xuyuning0430@gmail.com (CLAUDE.md 里 owner)
 */
import { config } from "dotenv";
config({ path: ".env.development" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const TARGET_EMAIL = process.argv[2] || "xuyuning0430@gmail.com";

async function main() {
  const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
  const p = new PrismaClient({ adapter });

  const user = await p.user.findFirst({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.error(`✗ 找不到用户 ${TARGET_EMAIL}`);
    process.exit(1);
  }
  console.log(`✓ 目标用户 ${user.username} (id=${user.id})`);

  // ───────── 1) 把一批内容 createdAt 拨到最近 24h 内 → NEW 徽章 ─────────
  const recentVideos = await p.video.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, title: true },
  });
  const recentImages = await p.imagePost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, title: true },
  });
  const recentGames = await p.game.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, title: true },
  });

  const now = Date.now();
  const newWindow = (i: number) => new Date(now - (i + 1) * 60 * 60 * 1000); // 1h, 2h, 3h, 4h ago

  for (let i = 0; i < recentVideos.length; i++) {
    await p.video.update({ where: { id: recentVideos[i].id }, data: { createdAt: newWindow(i) } });
  }
  for (let i = 0; i < recentImages.length; i++) {
    await p.imagePost.update({ where: { id: recentImages[i].id }, data: { createdAt: newWindow(i) } });
  }
  for (let i = 0; i < recentGames.length; i++) {
    await p.game.update({ where: { id: recentGames[i].id }, data: { createdAt: newWindow(i) } });
  }
  console.log(
    `✓ NEW 徽章: ${recentVideos.length} 个视频 / ${recentImages.length} 个图片 / ${recentGames.length} 个游戏 createdAt 已拨到最近 1-4h`,
  );

  // ───────── 2) WatchHistory: 部分进度 + 已看完 ─────────
  // 选 8 个有 duration 的视频
  const watchableVideos = await p.video.findMany({
    where: { status: "PUBLISHED", duration: { gt: 60 } },
    orderBy: { views: "desc" },
    take: 12,
    select: { id: true, title: true, duration: true },
  });

  const partialProgress = [0.15, 0.35, 0.6, 0.8, 0.45];
  const finishedProgress = [0.97, 0.99, 1.0];
  const allWatched = [...partialProgress, ...finishedProgress];

  for (let i = 0; i < allWatched.length && i < watchableVideos.length; i++) {
    const v = watchableVideos[i];
    const ratio = allWatched[i];
    const progressSec = Math.floor((v.duration ?? 600) * ratio);
    await p.watchHistory.upsert({
      where: { userId_videoId: { userId: user.id, videoId: v.id } },
      create: { userId: user.id, videoId: v.id, progress: progressSec },
      update: { progress: progressSec, updatedAt: new Date() },
    });
  }
  console.log(
    `✓ WatchHistory: ${partialProgress.length} 个有部分进度 (15%-80%), ${finishedProgress.length} 个已看完 (≥97%)`,
  );

  // ───────── 3) Favorite: 心形按钮 fill 态 ─────────
  const favVideos = await p.video.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { views: "desc" },
    take: 6,
    select: { id: true },
  });
  for (const v of favVideos) {
    await p.favorite.upsert({
      where: { userId_videoId: { userId: user.id, videoId: v.id } },
      create: { userId: user.id, videoId: v.id },
      update: {},
    });
  }

  const favImages = await p.imagePost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { views: "desc" },
    take: 5,
    select: { id: true },
  });
  for (const img of favImages) {
    await p.imagePostFavorite.upsert({
      where: { userId_imagePostId: { userId: user.id, imagePostId: img.id } },
      create: { userId: user.id, imagePostId: img.id },
      update: {},
    });
  }

  const favGames = await p.game.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { views: "desc" },
    take: 5,
    select: { id: true },
  });
  for (const g of favGames) {
    await p.gameFavorite.upsert({
      where: { userId_gameId: { userId: user.id, gameId: g.id } },
      create: { userId: user.id, gameId: g.id },
      update: {},
    });
  }
  console.log(
    `✓ Favorite: ${favVideos.length} 个视频 / ${favImages.length} 个图片 / ${favGames.length} 个游戏 已加收藏`,
  );

  console.log("\n现在登录后访问 /video /image /game 应该能看到：");
  console.log("  • 顶部 NEW 橙色徽章 (在最新发布的几张卡上)");
  console.log("  • 卡片下方红色进度条 / 已看完角标 (在视频卡上)");
  console.log("  • hover 时左下角浮出红色心形 (已收藏的会一直显示填充态)");
  console.log("  • 「本周排行」section 前 3 名金/银/铜冠");

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
