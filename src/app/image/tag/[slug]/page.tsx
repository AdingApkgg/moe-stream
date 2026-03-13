import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ImageTagPageClient } from "./client";
import { CollectionPageJsonLd } from "@/components/seo/json-ld";
import { cache } from "react";
import { getPublicSiteConfig } from "@/lib/site-config";

interface ImageTagPageProps {
  params: Promise<{ slug: string }>;
}

const getTag = cache(async (slug: string) => {
  return prisma.tag.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: { imagePosts: true },
      },
    },
  });
});

export async function generateStaticParams() {
  try {
    const popularTags = await prisma.tag.findMany({
      where: { imagePosts: { some: {} } },
      take: 50,
      orderBy: { imagePosts: { _count: "desc" } },
      select: { slug: true },
    });
    return popularTags.map((tag) => ({ slug: tag.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: ImageTagPageProps): Promise<Metadata> {
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
  const description = `浏览 ${tag.name} 标签下的 ${tag._count.imagePosts} 组图片`;

  return {
    title: `#${tag.name} - 图片`,
    description,
    keywords: [tag.name, "ACGN", "图片", "标签"],
    openGraph: {
      type: "website",
      title: `#${tag.name} 图片 - ${siteName}`,
      description,
    },
    twitter: {
      card: "summary",
      title: `#${tag.name} 图片 - ${siteName}`,
      description,
    },
  };
}

function serializeTag(tag: NonNullable<Awaited<ReturnType<typeof getTag>>>) {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    _count: tag._count,
  };
}

export type SerializedImageTag = ReturnType<typeof serializeTag>;

export default async function ImageTagPage({ params }: ImageTagPageProps) {
  const config = await getPublicSiteConfig();
  if (!config.sectionImageEnabled) notFound();
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const tag = await getTag(slug);

  const initialTag = tag ? serializeTag(tag) : null;
  const siteName = config.siteName;
  const siteUrl = config.siteUrl;

  return (
    <>
      {tag && (
        <CollectionPageJsonLd
          name={`#${tag.name} 图片 - ${siteName}`}
          description={`浏览 ${tag.name} 标签下的 ${tag._count.imagePosts} 组图片`}
          url={`${siteUrl}/image/tag/${tag.slug}`}
          numberOfItems={tag._count.imagePosts}
        />
      )}
      <ImageTagPageClient slug={slug} initialTag={initialTag} />
    </>
  );
}
