import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ExternalLink, FileText, Layers, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "llms.txt",
  description: "面向 AI 代理和大语言模型的结构化站点信息，帮助 AI 更好地理解和索引本站内容",
};

const files = [
  {
    path: "/llms.txt",
    label: "llms.txt",
    desc: "站点概要信息，包含平台介绍、主要功能和内容类型说明",
    size: "精简版",
  },
  {
    path: "/llms-full.txt",
    label: "llms-full.txt",
    desc: "包含网站统计、热门标签、最新内容列表等实时动态数据",
    size: "完整版",
  },
];

export default function LlmsPage() {
  return (
    <div className="container max-w-3xl py-10 space-y-10">
      <div className="space-y-3">
        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10">
          <Bot className="h-8 w-8 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">llms.txt</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          llms.txt 是一种面向大语言模型（LLM）和 AI 代理的标准化文本文件，以结构化的方式描述网站的内容和功能，帮助 AI
          更好地理解和索引站点信息。
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          可用文件
        </h2>
        <div className="grid gap-3">
          {files.map((file) => (
            <div key={file.path} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <code className="text-sm font-mono font-medium">{file.label}</code>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
                    {file.size}
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={file.path} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    查看
                  </a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{file.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          包含信息
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "平台介绍", desc: "站点名称、定位和主要功能描述" },
            { label: "内容类型", desc: "视频、游戏、图片等各类内容详细说明" },
            { label: "页面结构", desc: "各页面路径和用途，便于 AI 导航" },
            { label: "数据源", desc: "RSS、Sitemap、API 等机器可读数据入口" },
            { label: "实时统计", desc: "内容数量、用户数等运营数据（完整版）" },
            { label: "最新内容", desc: "最新发布的视频、游戏和图片列表（完整版）" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-4 space-y-1">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          使用场景
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-primary shrink-0">•</span>
            <span>AI 搜索引擎爬取和理解站点内容结构</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">•</span>
            <span>聊天机器人回答关于本站的问题时获取上下文</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">•</span>
            <span>自动化工具发现可用的 API 和数据接口</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary shrink-0">•</span>
            <span>AI 代理导航站点页面并执行自动化操作</span>
          </li>
        </ul>
      </div>

      <div className="text-sm text-muted-foreground pt-4 border-t">
        了解更多关于 llms.txt 标准，请访问{" "}
        <a
          href="https://llmstxt.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          llmstxt.org
        </a>
        。如需以编程方式访问站点功能，请参阅{" "}
        <Link href="/api-docs" className="text-primary hover:underline">
          API 文档
        </Link>
        。
      </div>
    </div>
  );
}
