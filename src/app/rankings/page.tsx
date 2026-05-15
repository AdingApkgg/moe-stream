import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSiteConfig } from "@/lib/site-config";
import { RankingsClient } from "./client";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  return {
    title: "排行榜",
    description: `${config.siteName} 视频排行榜：日榜、周榜、月榜、飙升榜`,
    alternates: {
      canonical: `${config.siteUrl}/rankings`,
    },
    openGraph: {
      title: `排行榜 - ${config.siteName}`,
      description: `${config.siteName} 视频排行榜`,
      url: `${config.siteUrl}/rankings`,
      type: "website",
      siteName: config.siteName,
      locale: "zh_CN",
    },
  };
}

export default async function RankingsPage() {
  const config = await getPublicSiteConfig();
  if (!config.rankingEnabled) notFound();
  return <RankingsClient />;
}
