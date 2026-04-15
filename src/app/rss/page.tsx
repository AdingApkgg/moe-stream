import type { Metadata } from "next";
import Link from "next/link";
import { Rss, ExternalLink, BookOpen, Bell, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRedirectUrl } from "@/lib/utils";
import { getPublicSiteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "RSS 订阅",
  description: "通过 RSS 订阅获取本站最新内容更新，支持视频、游戏和图片内容",
};

const readers = [
  { name: "Feedly", url: "https://feedly.com", desc: "最流行的在线 RSS 阅读器" },
  { name: "Inoreader", url: "https://www.inoreader.com", desc: "功能强大的 RSS 阅读器" },
  { name: "NetNewsWire", url: "https://netnewswire.com", desc: "macOS/iOS 免费开源阅读器" },
  { name: "Miniflux", url: "https://miniflux.app", desc: "极简自托管 RSS 阅读器" },
];

export default async function RssPage() {
  const siteConfig = await getPublicSiteConfig();
  const redirectOpts = { enabled: siteConfig.redirectEnabled, whitelist: siteConfig.redirectWhitelist };
  return (
    <div className="container max-w-3xl py-10 space-y-10">
      <div className="space-y-3">
        <div className="inline-flex p-3 rounded-2xl bg-orange-500/10">
          <Rss className="h-8 w-8 text-orange-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">RSS 订阅</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          RSS（Really Simple
          Syndication）是一种内容聚合格式，让你可以在一个阅读器中订阅并追踪多个网站的更新，无需反复访问每个站点。
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          订阅地址
        </h2>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
          <code className="flex-1 text-sm font-mono break-all select-all">/feed.xml</code>
          <Button variant="outline" size="sm" asChild>
            <a href="/feed.xml" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              打开
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">复制上方地址或直接打开，将其添加到你的 RSS 阅读器即可开始订阅。</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          订阅内容
        </h2>
        <p className="text-muted-foreground">RSS 订阅源包含以下类型的最新内容，按发布时间倒序排列：</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "视频", desc: "最新发布的 50 个视频", color: "bg-green-500/10 text-green-600" },
            { label: "游戏", desc: "最新发布的 30 个游戏", color: "bg-amber-500/10 text-amber-600" },
            { label: "图片", desc: "最新发布的 30 个图片帖", color: "bg-violet-500/10 text-violet-600" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-4 space-y-1">
              <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${item.color}`}>
                {item.label}
              </span>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          推荐阅读器
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {readers.map((reader) => (
            <a
              key={reader.name}
              href={getRedirectUrl(reader.url, redirectOpts)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium group-hover:text-primary transition-colors">{reader.name}</p>
                <p className="text-sm text-muted-foreground">{reader.desc}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
            </a>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground pt-4 border-t">
        订阅源遵循{" "}
        <a
          href={getRedirectUrl("https://www.rssboard.org/rss-specification", redirectOpts)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          RSS 2.0
        </a>{" "}
        规范，并支持 Media RSS 扩展以提供封面和媒体信息。如需更丰富的数据，可参阅{" "}
        <Link href="/api-docs" className="text-primary hover:underline">
          API 文档
        </Link>
        。
      </div>
    </div>
  );
}
