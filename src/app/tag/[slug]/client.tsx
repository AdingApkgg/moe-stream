"use client";

import { usePageParam } from "@/hooks/use-page-param";
import { useTabParam } from "@/hooks/use-tab-param";
import { trpc } from "@/lib/trpc";
import { VideoGrid } from "@/components/video/video-grid";
import { GameGrid } from "@/components/game/game-grid";
import { ImagePostCard } from "@/components/image/image-post-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileVideo, Gamepad2, Images, Tag } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import type { SerializedAggregateTag } from "./page";

interface TagAggregateClientProps {
  slug: string;
  initialTag: SerializedAggregateTag | null;
}

type ContentType = "video" | "game" | "image";

export function TagAggregateClient({
  slug,
  initialTag,
}: TagAggregateClientProps) {
  const [page, setPage] = usePageParam();

  const defaultTab: ContentType =
    (initialTag?._count?.videos ?? 0) > 0
      ? "video"
      : (initialTag?._count?.games ?? 0) > 0
        ? "game"
        : "image";

  const [activeTab, setActiveTab] = useTabParam<ContentType>(defaultTab);

  const { data: tagData, isLoading: tagLoading } = trpc.tag.getBySlug.useQuery(
    { slug, type: activeTab },
    {
      staleTime: initialTag ? 60000 : 0,
      refetchOnMount: !initialTag,
    }
  );

  const displayTag = tagData || initialTag;

  const { data: videoData, isLoading: videosLoading } =
    trpc.video.list.useQuery(
      { limit: 20, page, tagId: displayTag?.id },
      { enabled: activeTab === "video" && !!displayTag?.id, placeholderData: (prev) => prev }
    );

  const { data: gameData, isLoading: gamesLoading } =
    trpc.game.list.useQuery(
      { limit: 20, page, tagId: displayTag?.id },
      { enabled: activeTab === "game" && !!displayTag?.id, placeholderData: (prev) => prev }
    );

  const { data: imageData, isLoading: imagesLoading } =
    trpc.image.list.useQuery(
      { limit: 20, page, tagId: displayTag?.id },
      { enabled: activeTab === "image" && !!displayTag?.id, placeholderData: (prev) => prev }
    );

  const handleTabChange = (value: string) => {
    setActiveTab(value as ContentType);
    setPage(1);
  };

  if (!initialTag && !displayTag && !tagLoading) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-bold">标签不存在</h1>
        <p className="text-muted-foreground mt-2">
          找不到标签 &ldquo;{slug}&rdquo;
        </p>
        <Button asChild className="mt-4">
          <Link href="/tags">浏览全部标签</Link>
        </Button>
      </div>
    );
  }

  const videoCount = displayTag?._count?.videos ?? initialTag?._count?.videos ?? 0;
  const gameCount = displayTag?._count?.games ?? initialTag?._count?.games ?? 0;
  const imageCount = displayTag?._count?.imagePosts ?? initialTag?._count?.imagePosts ?? 0;

  return (
    <div className="container py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Tag className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              #{displayTag?.name || initialTag?.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              共 {videoCount + gameCount + imageCount} 个内容
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          {videoCount > 0 && (
            <TabsTrigger value="video" className="gap-1.5">
              <FileVideo className="h-4 w-4" />
              视频
              <Badge variant="secondary" className="ml-1 text-xs">{videoCount}</Badge>
            </TabsTrigger>
          )}
          {gameCount > 0 && (
            <TabsTrigger value="game" className="gap-1.5">
              <Gamepad2 className="h-4 w-4" />
              游戏
              <Badge variant="secondary" className="ml-1 text-xs">{gameCount}</Badge>
            </TabsTrigger>
          )}
          {imageCount > 0 && (
            <TabsTrigger value="image" className="gap-1.5">
              <Images className="h-4 w-4" />
              图片
              <Badge variant="secondary" className="ml-1 text-xs">{imageCount}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="video">
          <VideoGrid
            videos={videoData?.videos ?? []}
            isLoading={videosLoading || (!initialTag && tagLoading)}
          />
          <Pagination
            currentPage={page}
            totalPages={videoData?.totalPages ?? 1}
            onPageChange={setPage}
            className="mt-8"
          />
          {!videosLoading && (videoData?.videos ?? []).length === 0 && displayTag && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">该标签下暂无视频</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="game">
          <GameGrid
            games={gameData?.games ?? []}
            isLoading={gamesLoading || (!initialTag && tagLoading)}
          />
          <Pagination
            currentPage={page}
            totalPages={gameData?.totalPages ?? 1}
            onPageChange={setPage}
            className="mt-8"
          />
          {!gamesLoading && (gameData?.games ?? []).length === 0 && displayTag && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">该标签下暂无游戏</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="image">
          {(imagesLoading || (!initialTag && tagLoading)) ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {(imageData?.posts ?? []).map((post, index) => (
                <ImagePostCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
          <Pagination
            currentPage={page}
            totalPages={imageData?.totalPages ?? 1}
            onPageChange={setPage}
            className="mt-8"
          />
          {!imagesLoading && (imageData?.posts ?? []).length === 0 && displayTag && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">该标签下暂无图片</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
