import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { LinksClient } from "./client";

export const metadata: Metadata = {
  title: "友情链接",
  description: "友情链接",
};

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
