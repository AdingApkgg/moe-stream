import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { TagsPageClient } from "./client";
import { CollectionPageJsonLd } from "@/components/seo/json-ld";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  return {
    title: "标签",
    description: `浏览 ${config.siteName} 的所有标签，按分类查找 ACGN 相关内容`,
    keywords: ["标签", "分类", "ACGN", "动漫", "视频", "游戏"],
  };
}

async function getTagsData() {
  const [categories, videoTags, gameTags] = await Promise.all([
    prisma.tagCategory.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tag.findMany({
      where: { videos: { some: {} } },
      include: {
        category: true,
        _count: { select: { videos: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({
      where: { games: { some: {} } },
      include: {
        category: true,
        _count: { select: { games: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const groupByCategory = <T extends { categoryId: string | null }>(
    tags: T[],
  ) => {
    const grouped: {
      category: { id: string; name: string; slug: string; color: string } | null;
      tags: T[];
    }[] = [];

    for (const cat of categories) {
      const catTags = tags.filter((t) => t.categoryId === cat.id);
      if (catTags.length > 0) {
        grouped.push({
          category: { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color },
          tags: catTags,
        });
      }
    }

    const uncategorized = tags.filter((t) => !t.categoryId);
    if (uncategorized.length > 0) {
      grouped.push({ category: null, tags: uncategorized });
    }

    return grouped;
  };

  return {
    videoGroups: groupByCategory(videoTags),
    gameGroups: groupByCategory(gameTags),
    totalVideoTags: videoTags.length,
    totalGameTags: gameTags.length,
  };
}

export default async function TagsPage() {
  const [data, config] = await Promise.all([getTagsData(), getPublicSiteConfig()]);

  const totalTags = new Set([
    ...data.videoGroups.flatMap((g) => g.tags.map((t) => t.id)),
    ...data.gameGroups.flatMap((g) => g.tags.map((t) => t.id)),
  ]).size;

  return (
    <>
      <CollectionPageJsonLd
        name={`标签 - ${config.siteName}`}
        description={`浏览 ${config.siteName} 的 ${totalTags} 个内容标签`}
        url={`${config.siteUrl}/tags`}
        numberOfItems={totalTags}
      />
      <TagsPageClient
        videoGroups={data.videoGroups}
        gameGroups={data.gameGroups}
        totalVideoTags={data.totalVideoTags}
        totalGameTags={data.totalGameTags}
      />
    </>
  );
}
