import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import createMDX from "@next/mdx";

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
    typescript: {
      ignoreBuildErrors: true,
    },
    experimental: {
      serverActions: {
        bodySizeLimit: "10mb",
      },
      optimizePackageImports: [
        "lucide-react",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-aspect-ratio",
        "@radix-ui/react-avatar",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-collapsible",
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-hover-card",
        "@radix-ui/react-label",
        "@radix-ui/react-popover",
        "@radix-ui/react-progress",
        "@radix-ui/react-scroll-area",
        "@radix-ui/react-select",
        "@radix-ui/react-separator",
        "@radix-ui/react-slider",
        "@radix-ui/react-slot",
        "@radix-ui/react-switch",
        "@radix-ui/react-tabs",
        "@radix-ui/react-toggle",
        "@radix-ui/react-toggle-group",
        "@radix-ui/react-tooltip",
        "@radix-ui/react-visually-hidden",
        "radix-ui",
        "framer-motion",
        "recharts",
        "shiki",
        "@react-three/drei",
        "date-fns",
        "dayjs",
      ],
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

  const withMDX = createMDX({
    extension: /\.mdx?$/,
    options: {
      remarkPlugins: ["remark-gfm"],
    },
  });

  return withMDX(nextConfig);
}
