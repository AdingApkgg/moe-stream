import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getPublicSiteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const alt = "Image";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let post: {
    title: string;
    images: unknown;
    uploader: { nickname: string | null; username: string };
  } | null = null;

  try {
    post = await prisma.imagePost.findUnique({
      where: { id },
      select: {
        title: true,
        images: true,
        uploader: { select: { nickname: true, username: true } },
      },
    });
  } catch {
    // 数据库不可用时返回默认图片
  }

  if (!post) {
    return new ImageResponse(
      <div
        style={{
          fontSize: 48,
          background: "linear-gradient(to bottom right, #1a3a52, #0d1b2a)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        ACGN Image
      </div>,
      { ...size },
    );
  }

  const config = await getPublicSiteConfig().catch(() => null);
  const baseUrl = config?.siteUrl || "";
  const images = (post.images as string[] | null) ?? [];
  const firstImage = images[0];
  const fullImageUrl = firstImage ? (firstImage.startsWith("http") ? firstImage : `${baseUrl}${firstImage}`) : null;

  return new ImageResponse(
    <div
      style={{
        fontSize: 32,
        background: "linear-gradient(to bottom right, #1a3a52, #0d1b2a)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 60,
        color: "white",
      }}
    >
      {fullImageUrl && (
        // biome-ignore lint/performance/noImgElement: OG image generation requires native img
        <img
          src={fullImageUrl}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          flex: 1,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: "bold",
            marginBottom: 20,
            lineHeight: 1.2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {post.title}
        </div>
        <div style={{ fontSize: 24, opacity: 0.8 }}>
          {post.uploader.nickname || post.uploader.username} · {images.length} 张图片
        </div>
      </div>
    </div>,
    { ...size },
  );
}
