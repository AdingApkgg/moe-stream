"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast-with-sound";
import { Code2, Copy, KeyRound, FileVideo, Gamepad2, Image as ImageIcon, Terminal } from "lucide-react";
import type { UploadContentType } from "../_lib/types";

const API_BASE = "/api/trpc";

const ENDPOINTS: Record<UploadContentType, { create: string; batchCreate: string }> = {
  video: { create: "video.create", batchCreate: "video.batchCreate" },
  game: { create: "game.create", batchCreate: "game.batchCreate" },
  image: { create: "image.create", batchCreate: "image.batchCreate" },
};

const TYPE_LABELS: Record<UploadContentType, { label: string; icon: typeof FileVideo }> = {
  video: { label: "视频", icon: FileVideo },
  game: { label: "游戏", icon: Gamepad2 },
  image: { label: "图片", icon: ImageIcon },
};

const CREATE_EXAMPLES: Record<UploadContentType, string> = {
  video: JSON.stringify(
    {
      title: "视频标题",
      videoUrl: "https://example.com/video.mp4",
      description: "视频描述（可选）",
      coverUrl: "https://example.com/cover.jpg",
      tagNames: ["标签1", "标签2"],
      extraInfo: {
        author: "作者名",
        downloads: [{ name: "网盘", url: "https://pan.example.com/xxx", password: "1234" }],
      },
    },
    null,
    2,
  ),
  game: JSON.stringify(
    {
      title: "游戏标题",
      description: "游戏描述（可选）",
      coverUrl: "https://example.com/cover.jpg",
      gameType: "ADV",
      isFree: true,
      version: "Ver1.0",
      tagNames: ["标签1", "标签2"],
      extraInfo: {
        originalName: "原作名（可选）",
        originalAuthor: "作者",
        fileSize: "2.5GB",
        platforms: ["Windows", "Android"],
        screenshots: ["https://example.com/ss1.jpg"],
        downloads: [{ name: "夸克网盘", url: "https://...", password: "1234" }],
      },
    },
    null,
    2,
  ),
  image: JSON.stringify(
    {
      title: "图片标题",
      description: "图片描述（可选）",
      images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
      tagNames: ["标签1", "标签2"],
    },
    null,
    2,
  ),
};

const BATCH_EXAMPLES: Record<UploadContentType, string> = {
  video: JSON.stringify(
    {
      seriesTitle: "合集名称（可选）",
      videos: [
        { title: "视频标题1", videoUrl: "https://example.com/1.mp4", tagNames: ["标签"] },
        { title: "视频标题2", videoUrl: "https://example.com/2.mp4" },
      ],
    },
    null,
    2,
  ),
  game: JSON.stringify(
    {
      games: [
        { title: "游戏1", gameType: "ADV", isFree: true, tagNames: ["标签"] },
        { title: "游戏2", gameType: "RPG", isFree: true },
      ],
    },
    null,
    2,
  ),
  image: JSON.stringify(
    {
      posts: [
        { title: "图片帖1", images: ["https://example.com/1.jpg"], tagNames: ["标签"] },
        { title: "图片帖2", images: ["https://example.com/2.jpg", "https://example.com/3.jpg"] },
      ],
    },
    null,
    2,
  ),
};

function buildCurlExample(endpoint: string, body: string, origin: string): string {
  return `curl -X POST '${origin}${API_BASE}/${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer sk-your-api-key' \\
  -d '${JSON.stringify({ json: JSON.parse(body) })}'`;
}

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("已复制到剪贴板");
  };

  return (
    <div className="relative group">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto leading-relaxed">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

interface ApiPublishProps {
  contentType: UploadContentType;
}

export function ApiPublish({ contentType }: ApiPublishProps) {
  const [apiTab, setApiTab] = useState<"create" | "batch">("create");
  const endpoints = ENDPOINTS[contentType];
  const { label, icon: Icon } = TYPE_LABELS[contentType];
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            API 发布{label}
          </CardTitle>
          <CardDescription className="text-xs">
            通过 HTTP API 调用 tRPC 接口以编程方式发布内容，适合脚本、爬虫或自动化工作流
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 认证说明 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">认证方式</h3>
            <p className="text-xs text-muted-foreground">
              通过 <code className="px-1 py-0.5 bg-muted rounded text-[11px]">Authorization: Bearer</code> 头携带 API
              Key 进行认证。
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <code className="block text-xs font-mono">Authorization: Bearer sk-your-api-key</code>
              <p className="text-xs text-muted-foreground">
                前往{" "}
                <Link href="/settings/developer" className="text-primary underline underline-offset-2">
                  <KeyRound className="h-3 w-3 inline mr-0.5" />
                  设置 → 开发者
                </Link>{" "}
                创建和管理 API Key。创建时可选择权限范围（视频/游戏/图片）。
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px]">
                POST 请求
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                Content-Type: application/json
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                需 API Key + 投稿权限
              </Badge>
            </div>
          </div>

          {/* 接口文档 */}
          <Tabs value={apiTab} onValueChange={(v) => setApiTab(v as "create" | "batch")}>
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="create" className="text-xs h-7 gap-1 px-3">
                <Icon className="h-3.5 w-3.5" />
                单个创建
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-xs h-7 gap-1 px-3">
                <Terminal className="h-3.5 w-3.5" />
                批量创建
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="text-[11px]">POST</Badge>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {API_BASE}/{endpoints.create}
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">请求体（json 字段）</h4>
                <CodeBlock code={CREATE_EXAMPLES[contentType]} />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">curl 示例</h4>
                <CodeBlock
                  code={buildCurlExample(endpoints.create, CREATE_EXAMPLES[contentType], origin)}
                  language="bash"
                />
              </div>
            </TabsContent>

            <TabsContent value="batch" className="mt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="text-[11px]">POST</Badge>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {API_BASE}/{endpoints.batchCreate}
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">请求体（json 字段）</h4>
                <CodeBlock code={BATCH_EXAMPLES[contentType]} />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">curl 示例</h4>
                <CodeBlock
                  code={buildCurlExample(endpoints.batchCreate, BATCH_EXAMPLES[contentType], origin)}
                  language="bash"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 字段说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">字段说明</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldDocs contentType={contentType} />
        </CardContent>
      </Card>

      {/* 注意事项 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">注意事项</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs text-muted-foreground list-disc list-inside">
            <li>
              tRPC 请求体结构为 <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{`{"json": { ... }}`}</code>
              ，参数包裹在 json 字段内
            </li>
            <li>批量接口每次最多处理约 200 条数据，超出部分需分多次请求</li>
            <li>发布内容可能需管理员审核后才会公开展示，取决于站点配置</li>
            <li>图片和视频 URL 需为可公开访问的有效链接</li>
            <li>
              标签使用 <code className="px-1 py-0.5 bg-muted rounded text-[11px]">tagNames</code>{" "}
              字段传入名称数组，系统会自动匹配已有标签或创建新标签
            </li>
            <li>
              响应中 <code className="px-1 py-0.5 bg-muted rounded text-[11px]">result.data.json</code> 包含创建结果（含
              id、status 等）
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldDocs({ contentType }: { contentType: UploadContentType }) {
  const fields: { name: string; required: boolean; desc: string }[] = (() => {
    switch (contentType) {
      case "video":
        return [
          { name: "title", required: true, desc: "视频标题，1-100 字符" },
          { name: "videoUrl", required: true, desc: "视频文件 URL（必须为有效 URL）" },
          { name: "description", required: false, desc: "视频描述，最长 5000 字符" },
          { name: "coverUrl", required: false, desc: "封面图 URL" },
          { name: "tagNames", required: false, desc: "标签名称数组" },
          { name: "extraInfo.author", required: false, desc: "作者名称" },
          { name: "extraInfo.downloads", required: false, desc: "下载链接数组 [{name, url, password?}]" },
          { name: "extraInfo.keywords", required: false, desc: "关键词数组" },
        ];
      case "game":
        return [
          { name: "title", required: true, desc: "游戏标题，1-200 字符" },
          { name: "description", required: false, desc: "游戏描述，最长 5000 字符" },
          { name: "coverUrl", required: false, desc: "封面图 URL" },
          { name: "gameType", required: false, desc: "游戏类型（ADV, SLG, RPG, ACT 等）" },
          { name: "isFree", required: false, desc: "是否免费，默认 true" },
          { name: "version", required: false, desc: "版本号（如 Ver1.0）" },
          { name: "tagNames", required: false, desc: "标签名称数组" },
          { name: "extraInfo.downloads", required: false, desc: "下载链接数组 [{name, url, password?}]" },
          { name: "extraInfo.platforms", required: false, desc: "支持平台数组（Windows, Android 等）" },
          { name: "extraInfo.screenshots", required: false, desc: "截图 URL 数组" },
          { name: "extraInfo.fileSize", required: false, desc: "文件大小（如 2.5GB）" },
        ];
      case "image":
        return [
          { name: "title", required: true, desc: "标题，1-200 字符" },
          { name: "images", required: true, desc: "图片 URL 数组（至少一张）" },
          { name: "description", required: false, desc: "描述，最长 5000 字符" },
          { name: "tagNames", required: false, desc: "标签名称数组" },
        ];
    }
  })();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-4 font-medium">字段</th>
            <th className="text-left py-2 pr-4 font-medium w-16">必填</th>
            <th className="text-left py-2 font-medium">说明</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b last:border-0">
              <td className="py-2 pr-4">
                <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{f.name}</code>
              </td>
              <td className="py-2 pr-4">
                {f.required ? (
                  <Badge variant="default" className="text-[10px] py-0">
                    必填
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] py-0">
                    可选
                  </Badge>
                )}
              </td>
              <td className="py-2 text-muted-foreground">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
