import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  const description = config.siteDescription || `${config.siteName} - 发现最新 ACGN 视频与游戏内容`;
  return {
    title: `${config.siteName} - ${description}`,
    description,
    alternates: {
      canonical: config.siteUrl,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: config.siteName,
      url: config.siteUrl,
      title: `${config.siteName} - ${description}`,
      description,
    },
  };
}

/**
 * 首页：直接重定向到默认内容区，避免让用户做"先选视频/图片/游戏"的选择题。
 * 优先级：视频 → 图片 → 游戏（按已启用的第一个）；全部禁用时回退到 /video（404 由各分区处理）。
 */
export default async function HomePage() {
  const config = await getPublicSiteConfig();
  if (config.sectionVideoEnabled !== false) redirect("/video");
  if (config.sectionImageEnabled !== false) redirect("/image");
  if (config.sectionGameEnabled !== false) redirect("/game");
  redirect("/video");
}
