import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const config = await getPublicSiteConfig();
  const baseUrl = config.siteUrl;

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { videos: { some: { status: "PUBLISHED" } } },
          { games: { some: { status: "PUBLISHED" } } },
          { imagePosts: { some: { status: "PUBLISHED" } } },
        ],
      },
      select: { id: true, updatedAt: true },
      take: 1000,
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${users
  .map(
    (user) => `  <url>
    <loc>${baseUrl}/user/${user.id}</loc>
    <lastmod>${user.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    if (process.env.NODE_ENV !== "production") console.warn("Users sitemap: DB unavailable, returning empty");
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      {
        headers: { "Content-Type": "application/xml" },
      },
    );
  }
}
