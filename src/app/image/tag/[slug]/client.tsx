"use client";

import { useCallback } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { trpc } from "@/lib/trpc";
import { ImageGrid } from "@/components/image/image-grid";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Images, Tag } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import type { SerializedImageTag } from "./page";

const IMAGE_GRID_COLS = "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

interface ImageTagPageClientProps {
  slug: string;
  initialTag: SerializedImageTag | null;
}

export function ImageTagPageClient({ slug, initialTag }: ImageTagPageClientProps) {
  const [page, setPage] = usePageParam();

  const { data: tag, isLoading: tagLoading } = trpc.tag.getBySlug.useQuery(
    { slug, type: "image" },
    {
      staleTime: initialTag ? 60000 : 0,
      refetchOnMount: !initialTag,
    },
  );

  const displayTag = tag || initialTag;

  // 翻页时立即切换到骨架屏，避免旧图还在占位时用户以为没响应
  const { data, isLoading, isFetching } = trpc.image.list.useQuery(
    { limit: 20, page, tagId: displayTag?.id },
    { enabled: !!displayTag?.id },
  );

  const posts = data?.posts ?? [];
  const totalPages = data?.totalPages ?? 1;
  const showSkeleton = (isLoading || isFetching || (!initialTag && tagLoading)) && posts.length === 0;

  const handlePageChange = useCallback(
    (next: number) => {
      setPage(next);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [setPage],
  );

  if (!initialTag && !displayTag && !tagLoading) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-bold">标签不存在</h1>
        <p className="text-muted-foreground mt-2">找不到标签 &ldquo;{slug}&rdquo;</p>
        <Button asChild className="mt-4">
          <Link href="/image">浏览全部图片</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Tag className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              #{displayTag?.name || initialTag?.name}
              <Images className="h-5 w-5 text-muted-foreground" />
            </h1>
            <p className="text-sm text-muted-foreground">
              共 {displayTag?.imagePostCount ?? initialTag?.imagePostCount ?? 0} 组图片
            </p>
          </div>
        </div>
      </div>

      {showSkeleton ? (
        <ImageGrid posts={[]} isLoading columnsClass={IMAGE_GRID_COLS} />
      ) : posts.length > 0 ? (
        <ImageGrid posts={posts} columnsClass={IMAGE_GRID_COLS} adSeed={`image-tag-${slug}-${page}`} />
      ) : null}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} className="mt-8" />

      {!isLoading && !isFetching && posts.length === 0 && displayTag && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">该标签下暂无图片</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/image">浏览全部图片</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
