import type { MetadataRoute } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const config = await getPublicSiteConfig();
  return {
    name: config.siteName,
    short_name: config.siteName,
    description: config.siteDescription || `${config.siteName} 流式媒体内容分享平台`,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    icons: [
      {
        src: config.siteLogo || "/favicon.ico",
        sizes: config.siteLogo ? "180x180" : "32x32",
        type: config.siteLogo ? "image/webp" : "image/x-icon",
      },
    ],
    categories: ["entertainment", "video"],
    lang: "zh-CN",
  };
}
