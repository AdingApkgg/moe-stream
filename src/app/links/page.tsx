import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { LinksClient } from "./client";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  return {
    title: "友情链接",
    description: `${config.siteName} 的友情链接`,
    alternates: { canonical: `${config.siteUrl}/links` },
  };
}

export default async function LinksPage() {
  const links = await prisma.friendLink.findMany({
    where: { visible: true },
    orderBy: [{ sort: "desc" }, { createdAt: "desc" }],
  });

  const serializedLinks = links.map((link) => ({
    ...link,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  }));

  return <LinksClient links={serializedLinks} />;
}
