import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getPublicSiteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const alt = "Game";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let game: {
    title: string;
    coverUrl: string | null;
    gameType: string | null;
    uploader: { nickname: string | null; username: string };
  } | null = null;

  try {
    game = await prisma.game.findUnique({
      where: { id },
      select: {
        title: true,
        coverUrl: true,
        gameType: true,
        uploader: { select: { nickname: true, username: true } },
      },
    });
  } catch {
    // 数据库不可用时返回默认图片
  }

  if (!game) {
    return new ImageResponse(
      <div
        style={{
          fontSize: 48,
          background: "linear-gradient(to bottom right, #2d1b69, #11052c)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        ACGN Game
      </div>,
      { ...size },
    );
  }

  const config = await getPublicSiteConfig().catch(() => null);
  const baseUrl = config?.siteUrl || "";
  const coverFullUrl = game.coverUrl
    ? game.coverUrl.startsWith("http")
      ? game.coverUrl
      : `${baseUrl}${game.coverUrl}`
    : null;

  return new ImageResponse(
    <div
      style={{
        fontSize: 32,
        background: "linear-gradient(to bottom right, #2d1b69, #11052c)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 60,
        color: "white",
      }}
    >
      {coverFullUrl && (
        // biome-ignore lint/performance/noImgElement: OG image generation requires native img
        <img
          src={coverFullUrl}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.25,
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
        {game.gameType && (
          <div
            style={{
              fontSize: 22,
              opacity: 0.85,
              marginBottom: 12,
              padding: "4px 14px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 999,
              alignSelf: "flex-start",
            }}
          >
            {game.gameType}
          </div>
        )}
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
          {game.title}
        </div>
        <div style={{ fontSize: 24, opacity: 0.8 }}>{game.uploader.nickname || game.uploader.username}</div>
      </div>
    </div>,
    { ...size },
  );
}
