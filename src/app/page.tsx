import LandingClient from "./client";
import type { Metadata } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";

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

export default async function HomePage() {
  const config = await getPublicSiteConfig();
  const description = config.siteDescription || `${config.siteName} 流式媒体内容分享平台`;
  const logo =
    config.siteLogo && config.siteLogo.startsWith("http")
      ? config.siteLogo
      : `${config.siteUrl}${config.siteLogo || "/Mikiacg-logo.webp"}`;

  return (
    <>
      {/* SEO 结构化数据 - 首页站点信息 */}
      <WebsiteJsonLd siteName={config.siteName} siteUrl={config.siteUrl} description={description} />
      <OrganizationJsonLd name={config.siteName} url={config.siteUrl} logo={logo} contactEmail={config.contactEmail} />
      <LandingClient />
    </>
  );
}
