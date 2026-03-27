import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import remarkGfm from "remark-gfm";

export default function config(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    process.env.NEXT_BUILD = "1";
  }

  const isServerless = !!process.env.VERCEL || !!process.env.NETLIFY;

  const nextConfig: NextConfig = {
    output: isServerless ? undefined : "standalone",
    pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
    turbopack: {
      rules: {
        "*.mdx": {
          loaders: [{ loader: "./mdx-loader.mjs" }],
          as: "*.jsx",
        },
      },
    },
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
    webpack: (webpackConfig) => {
      webpackConfig.module.rules.push({
        test: /\.mdx?$/,
        use: [
          {
            loader: "@mdx-js/loader",
            options: {
              remarkPlugins: [remarkGfm],
              providerImportSource: "@mdx-js/react",
            },
          },
        ],
      });
      return webpackConfig;
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

  return nextConfig;
}
