import { prisma } from "@/lib/prisma";
import { GameListClient } from "./client";
import { cache } from "react";
import { getPublicSiteConfig } from "@/lib/site-config";
import { pickWeightedRandomAds, type Ad } from "@/lib/ads";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "游戏",
  description: "发现精选 ACGN 游戏，免费下载各种 ADV、SLG、RPG、ACT 类型游戏",
  keywords: ["ACGN", "游戏", "ADV", "SLG", "RPG", "免费游戏", "galgame"],
};

const getInitialData = cache(async () => {
  const [tags, games, typeStats, siteConfig, fullConfig] = await Promise.all([
    // 获取热门游戏标签
    prisma.tag.findMany({
      where: {
        games: { some: { game: { status: "PUBLISHED" } } },
      },
      take: 30,
      orderBy: { games: { _count: "desc" } },
      select: { id: true, name: true, slug: true },
    }),
    // 获取最新游戏（首屏数据）
    prisma.game.findMany({
      take: 20,
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
        tags: {
          include: { tag: { select: { id: true, name: true, slug: true } } },
        },
        _count: { select: { likes: true, dislikes: true, favorites: true } },
      },
    }),
    // 获取游戏类型统计
    prisma.game.groupBy({
      by: ["gameType"],
      where: { status: "PUBLISHED" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // 获取公告配置
    prisma.siteConfig.findFirst({
      select: {
        announcement: true,
        announcementEnabled: true,
      },
    }),
    // 获取完整站点配置（含广告列表）
    getPublicSiteConfig(),
  ]);

  // 服务端预选 4 条广告（SSR 直出）
  const rawAds: Ad[] = Array.isArray(fullConfig.sponsorAds)
    ? (fullConfig.sponsorAds as Ad[]).filter((a) => a.enabled !== false)
    : [];
  const initialAds = fullConfig.adsEnabled ? pickWeightedRandomAds(rawAds, 4) : [];

  return {
    tags,
    games,
    siteConfig,
    initialAds,
    typeStats: typeStats.map((s) => ({
      type: s.gameType || "OTHER",
      count: s._count.id,
    })),
  };
});

function serializeGames(games: Awaited<ReturnType<typeof getInitialData>>["games"]) {
  return games.map((game) => ({
    id: game.id,
    title: game.title,
    description: game.description,
    coverUrl: game.coverUrl,
    gameType: game.gameType,
    isFree: game.isFree,
    version: game.version,
    views: game.views,
    createdAt: game.createdAt.toISOString(),
    extraInfo: game.extraInfo,
    uploader: game.uploader,
    tags: game.tags,
    _count: game._count,
  }));
}

export default async function GameListPage() {
  const { tags, games, typeStats, siteConfig, initialAds } = await getInitialData();
  const serializedGames = serializeGames(games);

  return (
    <GameListClient
      initialTags={tags}
      initialGames={serializedGames}
      typeStats={typeStats}
      siteConfig={siteConfig}
      initialAds={initialAds}
    />
  );
}
