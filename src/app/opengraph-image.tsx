import { ImageResponse } from "next/og";
import { getPublicSiteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const alt = "Site OG Image";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const config = await getPublicSiteConfig();
  const siteName = config.siteName;
  const description = config.siteDescription || `${siteName} 内容分享平台`;

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontWeight: "bold" }}>{siteName}</span>
        </div>
        <div
          style={{
            fontSize: 28,
            marginTop: 24,
            opacity: 0.8,
          }}
        >
          {description}
        </div>
      </div>
    ),
    { ...size }
  );
}
