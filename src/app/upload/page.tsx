"use client";

import { useState, useMemo } from "react";
import { useSession } from "@/lib/auth-client";
import { useSiteConfig } from "@/contexts/site-config";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useSound } from "@/hooks/use-sound";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Code2,
  FileVideo,
  FolderOpen,
  Gamepad2,
  Image as ImageIcon,
  ListVideo,
  Loader2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/motion";
import type { UploadContentType } from "./_lib/types";
import { VideoSingleUpload } from "./_components/video-single";
import { VideoBatchUpload } from "./_components/video-batch";
import { GameSingleUpload } from "./_components/game-single";
import { GameBatchUpload } from "./_components/game-batch";
import { ImageSingleUpload } from "./_components/image-single";
import { ImageBatchUpload } from "./_components/image-batch";
import { ApiPublish } from "./_components/api-publish";

type UploadMode = "single" | "json-import" | "api";

const TYPE_CONFIG = {
  video: { label: "视频", icon: FileVideo, description: "上传视频作品", color: "text-blue-500 bg-blue-500/10" },
  game: { label: "游戏", icon: Gamepad2, description: "上传游戏资源", color: "text-violet-500 bg-violet-500/10" },
  image: { label: "图片", icon: ImageIcon, description: "上传图片作品", color: "text-emerald-500 bg-emerald-500/10" },
} as const;

export default function UploadPage() {
  const { data: session, status } = useSession();
  const { play } = useSound();
  const config = useSiteConfig();
  const [contentType, setContentType] = useState<UploadContentType>("video");
  const [mode, setMode] = useState<UploadMode>("single");

  const contentTypeOptions = useMemo(
    () =>
      (["video", "game", "image"] as const).filter((id) => {
        if (id === "video") return config?.sectionVideoEnabled !== false;
        if (id === "game") return config?.sectionGameEnabled !== false;
        if (id === "image") return config?.sectionImageEnabled !== false;
        return true;
      }),
    [config],
  );

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-muted">
          <Upload className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">请先登录</h1>
        <p className="text-muted-foreground">登录后才能投稿</p>
        <Button asChild size="lg">
          <Link href="/login?callbackUrl=/upload">去登录</Link>
        </Button>
      </div>
    );
  }

  if (!session.user.canUpload) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">暂无投稿权限</h1>
        <p className="text-muted-foreground text-center max-w-md">您的账号暂未开通投稿功能，请联系管理员申请开通</p>
        <Button asChild variant="outline">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    );
  }

  const renderContent = () => {
    if (mode === "api") return <ApiPublish contentType={contentType} />;
    const components = {
      video: { single: VideoSingleUpload, "json-import": VideoBatchUpload },
      game: { single: GameSingleUpload, "json-import": GameBatchUpload },
      image: { single: ImageSingleUpload, "json-import": ImageBatchUpload },
    };
    const Component = components[contentType][mode];
    return <Component />;
  };

  return (
    <div className="container py-6 max-w-5xl">
      {/* 标题区 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6" />
            发布内容
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">选择内容类型和发布方式</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/my-works">
            <ListVideo className="h-4 w-4" />
            我的投稿
          </Link>
        </Button>
      </div>

      <Separator className="mb-6" />

      {/* 内容类型选择 */}
      <div
        className={cn(
          "grid gap-3 mb-6",
          contentTypeOptions.length === 3
            ? "grid-cols-3"
            : contentTypeOptions.length === 2
              ? "grid-cols-2"
              : "grid-cols-1",
        )}
      >
        {contentTypeOptions.map((id) => {
          const cfg = TYPE_CONFIG[id];
          const Icon = cfg.icon;
          const isActive = contentType === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setContentType(id);
                play("navigate");
              }}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20",
              )}
            >
              <div className={cn("shrink-0 p-2.5 rounded-lg", cfg.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm">{cfg.label}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{cfg.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 统一模式 Tabs */}
      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(v as UploadMode);
          play("navigate");
        }}
        className="mb-6"
      >
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="single" className="gap-2">
            {contentType === "video" ? (
              <FileVideo className="h-4 w-4" />
            ) : contentType === "game" ? (
              <Gamepad2 className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            单个发布
          </TabsTrigger>
          <TabsTrigger value="json-import" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            JSON 导入
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Code2 className="h-4 w-4" />
            API 发布
          </TabsTrigger>
        </TabsList>

        <TabsContent value={mode} forceMount className="mt-6">
          <FadeIn key={`${contentType}-${mode}`} duration={0.25} direction="none">
            {renderContent()}
          </FadeIn>
        </TabsContent>
      </Tabs>
    </div>
  );
}
