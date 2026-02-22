import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/500.css";
import "@fontsource/noto-sans-jp/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppLayout } from "@/components/layout/app-layout";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  const siteName = config.siteName;
  const baseUrl = config.siteUrl;
  const description = config.siteDescription || `${siteName} 流式媒体内容分享平台，提供丰富的动画、漫画、游戏、轻小说相关内容。`;
  const keywords = config.siteKeywords
    ? config.siteKeywords.split(",").map((k) => k.trim()).filter(Boolean)
    : ["ACGN", "动漫", "视频", "anime", "动画", "漫画", "游戏", "轻小说", "二次元"];

  let metadataBase: URL;
  try {
    metadataBase = new URL(baseUrl);
  } catch {
    metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  }

  return {
    metadataBase,
    title: {
      default: `${siteName} - ${description}`,
      template: `%s | ${siteName}`,
    },
    description,
    keywords,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: baseUrl,
      siteName,
      title: `${siteName} - ${description}`,
      description,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} - ${description}`,
      description,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
    ...(config.googleVerification ? { verification: { google: config.googleVerification } } : {}),
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteName,
    },
    applicationName: siteName,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// 强制服务端每次请求拉取配置（含广告），避免生产环境使用构建时空配置导致广告不加载
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml" />
        <link rel="author" href="/llms.txt" />
        <link rel="help" href="/llms-full.txt" />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}

/** 异步 Server Component：预取站点配置并注入 Providers */
async function RootProviders({ children }: { children: React.ReactNode }) {
  const siteConfig = await getPublicSiteConfig();
  return (
    <Providers siteConfig={siteConfig}>
      <AppLayout>{children}</AppLayout>
    </Providers>
  );
}
