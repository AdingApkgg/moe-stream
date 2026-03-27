import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const config = await getPublicSiteConfig();
  const baseUrl = config.siteUrl;

  try {
    const images = await prisma.imagePost.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${images
  .map(
    (image) => `  <url>
    <loc>${baseUrl}/image/${image.id}</loc>
    <lastmod>${image.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
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
    if (process.env.NODE_ENV !== "production") console.warn("Images sitemap: DB unavailable, returning empty");
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      {
        headers: { "Content-Type": "application/xml" },
      },
    );
  }
}
