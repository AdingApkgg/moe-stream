import type { MetadataRoute } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getPublicSiteConfig();
  const baseUrl = config.siteUrl;

  return [
    {
      url: `${baseUrl}/sitemap/static.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap/videos.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap/games.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap/tags.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap/users.xml`,
      lastModified: new Date(),
    },
  ];
}
