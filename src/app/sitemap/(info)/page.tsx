import type { Metadata } from "next";
import Link from "next/link";
import { Map, ExternalLink, Globe, Search, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sitemap 站点地图",
  description: "本站站点地图说明，帮助搜索引擎和用户了解网站的完整页面结构",
};

const sitemaps = [
  { path: "/sitemap/static.xml", label: "static.xml", desc: "首页、分类页等静态页面" },
  { path: "/sitemap/videos.xml", label: "videos.xml", desc: "所有已发布的视频页面" },
  { path: "/sitemap/games.xml", label: "games.xml", desc: "所有已发布的游戏页面" },
  { path: "/sitemap/images.xml", label: "images.xml", desc: "所有已发布的图片帖页面" },
  { path: "/sitemap/tags.xml", label: "tags.xml", desc: "所有标签浏览页面" },
  { path: "/sitemap/users.xml", label: "users.xml", desc: "所有用户主页" },
];

export default function SitemapInfoPage() {
  return (
    <div className="container max-w-3xl py-10 space-y-10">
      <div className="space-y-3">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10">
          <Map className="h-8 w-8 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Sitemap 站点地图</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Sitemap（站点地图）是一个 XML 文件，列出了网站中所有可供搜索引擎抓取的页面，帮助 Google、Bing
          等搜索引擎更高效地发现和索引站点内容。
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          入口地址
        </h2>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
          <code className="flex-1 text-sm font-mono break-all select-all">/sitemap.xml</code>
          <Button variant="outline" size="sm" asChild>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              打开
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          这是站点地图索引文件，包含指向下方所有子地图的引用。搜索引擎通常只需要知道这个入口地址。
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-muted-foreground" />
          子站点地图
        </h2>
        <p className="text-muted-foreground text-sm">为提升性能和可维护性，站点地图按内容类型拆分为多个子文件：</p>
        <div className="grid gap-2">
          {sitemaps.map((item) => (
            <a
              key={item.path}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <code className="text-sm font-mono text-primary">{item.label}</code>
                <span className="text-sm text-muted-foreground hidden sm:inline">{item.desc}</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          搜索引擎提交
        </h2>
        <p className="text-sm text-muted-foreground">
          如果你是站长或 SEO 人员，可以将站点地图提交至以下搜索引擎的站长工具以加速收录：
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { name: "Google Search Console", url: "https://search.google.com/search-console" },
            { name: "Bing Webmaster Tools", url: "https://www.bing.com/webmasters" },
            { name: "Yandex Webmaster", url: "https://webmaster.yandex.com" },
            { name: "百度搜索资源平台", url: "https://ziyuan.baidu.com" },
          ].map((engine) => (
            <a
              key={engine.name}
              href={engine.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              <span>{engine.name}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground pt-4 border-t">
        站点地图遵循{" "}
        <a
          href="https://www.sitemaps.org/protocol.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Sitemaps 协议
        </a>
        。如需获取最新内容推送，也可通过{" "}
        <Link href="/rss" className="text-primary hover:underline">
          RSS 订阅
        </Link>{" "}
        进行追踪。
      </div>
    </div>
  );
}
