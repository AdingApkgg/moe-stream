import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TagAggregateClient } from "./client";
import { CollectionPageJsonLd } from "@/components/seo/json-ld";
import { cache } from "react";
import { getPublicSiteConfig } from "@/lib/site-config";

interface TagPageProps {
  params: Promise<{ slug: string }>;
}

const getTag = cache(async (slug: string) => {
  return prisma.tag.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      videoCount: true,
      gameCount: true,
      imagePostCount: true,
    },
  });
});

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const tag = await getTag(slug);

  if (!tag) {
    return {
      title: "标签不存在",
      description: "该标签可能已被删除或不存在",
    };
  }

  const siteConfig = await getPublicSiteConfig();
  const siteName = siteConfig.siteName;
  const total = tag.videoCount + tag.gameCount + tag.imagePostCount;
  const description = `浏览 ${tag.name} 标签下的 ${total} 个内容`;
  const url = `${siteConfig.siteUrl}/tag/${tag.slug}`;

  return {
    title: `#${tag.name}`,
    description,
    keywords: [tag.name, "ACGN", "标签"],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName,
      url,
      title: `#${tag.name} - ${siteName}`,
      description,
    },
    twitter: {
      card: "summary",
      title: `#${tag.name} - ${siteName}`,
      description,
    },
  };
}

function serializeTag(tag: NonNullable<Awaited<ReturnType<typeof getTag>>>) {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    videoCount: tag.videoCount,
    gameCount: tag.gameCount,
    imagePostCount: tag.imagePostCount,
  };
}

export type SerializedAggregateTag = ReturnType<typeof serializeTag>;

export default async function TagPage({ params }: TagPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const tag = await getTag(slug);

  const initialTag = tag ? serializeTag(tag) : null;
  const config = await getPublicSiteConfig();
  const siteName = config.siteName;
  const siteUrl = config.siteUrl;

  const total = tag ? tag.videoCount + tag.gameCount + tag.imagePostCount : 0;

  return (
    <>
      {tag && (
        <CollectionPageJsonLd
          name={`#${tag.name} - ${siteName}`}
          description={`浏览 ${tag.name} 标签下的 ${total} 个内容`}
          url={`${siteUrl}/tag/${tag.slug}`}
          numberOfItems={total}
        />
      )}
      <TagAggregateClient slug={slug} initialTag={initialTag} />
    </>
  );
}
