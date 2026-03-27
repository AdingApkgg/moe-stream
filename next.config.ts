import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import createMDX from "@next/mdx";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";

export default function config(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    process.env.NEXT_BUILD = "1";
  }

  const isServerless = !!process.env.VERCEL || !!process.env.NETLIFY;

  const nextConfig: NextConfig = {
    output: isServerless ? undefined : "standalone",
    pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
    turbopack: {},
    images: {
      unoptimized: false,
      remotePatterns: [
        {
          protocol: "https",
          hostname: "**",
        },
        {
          protocol: "http",
          hostname: "**",
        },
      ],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      formats: ["image/avif", "image/webp"],
      minimumCacheTTL: 31536000,
    },
    experimental: {
      serverActions: {
        bodySizeLimit: "10mb",
      },
      optimizeCss: true,
    },
    async rewrites() {
      return [
        {
          source: "/uploads/:path*",
          destination: "/api/cover/uploads/:path*",
        },
      ];
    },
    async redirects() {
      if (process.env.NODE_ENV !== "production") return [];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) return [];
      const urlObj = new URL(appUrl);
      const host = urlObj.hostname.replace(/\./g, "\\.");
      return [
        {
          source: "/:path*",
          has: [
            {
              type: "host",
              value: `(?!^${host}$).*`,
            },
          ],
          destination: `${appUrl}/:path*`,
          permanent: true,
        },
      ];
    },
  };

  const prettyCodeOptions: PrettyCodeOptions = {
    theme: { dark: "github-dark-dimmed", light: "github-light" },
    keepBackground: false,
    defaultLang: "plaintext",
  };

  const withMDX = createMDX({
    extension: /\.mdx?$/,
    options: {
      remarkPlugins: ["remark-gfm"],
      rehypePlugins: [[rehypePrettyCode, prettyCodeOptions]],
    },
  });

  return withMDX(nextConfig);
}
