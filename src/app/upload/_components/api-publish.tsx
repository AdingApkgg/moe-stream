"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Code2, KeyRound } from "lucide-react";
import type { UploadContentType } from "../_lib/types";

const TYPE_LABELS: Record<UploadContentType, string> = {
  video: "视频",
  game: "游戏",
  image: "图片",
};

interface ApiPublishProps {
  contentType: UploadContentType;
}

export function ApiPublish({ contentType }: ApiPublishProps) {
  const label = TYPE_LABELS[contentType];

  return (
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
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            使用 API 发布内容需要先在{" "}
            <Link href="/settings/developer" className="text-primary underline underline-offset-2">
              <KeyRound className="h-3 w-3 inline mr-0.5" />
              设置 → 开发者
            </Link>{" "}
            创建 API Key，然后通过 HTTP 请求调用接口。
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[11px]">
              需要 <code className="ml-1">content:write</code> 权限
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              上传文件需要 <code className="ml-1">file:write</code> 权限
            </Badge>
          </div>
        </div>

        <Button asChild className="w-full" variant="outline">
          <Link href="/api-docs">
            <BookOpen className="h-4 w-4 mr-2" />
            查看完整 API 文档
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
