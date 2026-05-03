import type { MetadataRoute } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 获取各分类下最新内容的 updatedAt，作为对应 sitemap 的 lastModified。
 * 让搜索引擎能够依据增量索引判断哪些子 sitemap 有新内容。
 */
async function getLatestUpdates() {
  try {
    const [video, game, image, tag, user] = await Promise.all([
      prisma.video.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.game.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.imagePost.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.tag.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.user.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);
    return {
      video: video?.updatedAt ?? new Date(),
      game: game?.updatedAt ?? new Date(),
      image: image?.updatedAt ?? new Date(),
      tag: tag?.updatedAt ?? new Date(),
      user: user?.updatedAt ?? new Date(),
    };
  } catch {
    const now = new Date();
    return { video: now, game: now, image: now, tag: now, user: now };
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getPublicSiteConfig();
  const baseUrl = config.siteUrl;
  const latest = await getLatestUpdates();

  return [
    {
      url: `${baseUrl}/sitemap/static.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap/videos.xml`,
      lastModified: latest.video,
    },
    {
      url: `${baseUrl}/sitemap/games.xml`,
      lastModified: latest.game,
    },
    {
      url: `${baseUrl}/sitemap/images.xml`,
      lastModified: latest.image,
    },
    {
      url: `${baseUrl}/sitemap/tags.xml`,
      lastModified: latest.tag,
    },
    {
      url: `${baseUrl}/sitemap/users.xml`,
      lastModified: latest.user,
    },
  ];
}
