"use client";

import { trpc } from "@/lib/trpc";
import { ImagePostCard } from "@/components/image/image-post-card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { Images } from "lucide-react";
import { MotionPage } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CollapsibleTagBar } from "@/components/ui/collapsible-tag-bar";
import { useTagFilter } from "@/hooks/use-tag-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { AdCard } from "@/components/ads/ad-card";
import { useInlineAds } from "@/hooks/use-inline-ads";
import { useUIStore } from "@/stores/app";
import { useSiteConfig } from "@/contexts/site-config";

type SortBy = "latest" | "views" | "likes" | "title";

const ALL_SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "latest", label: "最新" },
  { id: "views", label: "热门" },
  { id: "likes", label: "高赞" },
  { id: "title", label: "标题" },
];

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface ImagePost {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  views: number;
  createdAt: string;
  uploader: {
    id: string;
    username: string;
    nickname?: string | null;
    avatar?: string | null;
  };
  tags?: { tag: { id: string; name: string; slug: string } }[];
}

interface ImageListClientProps {
  initialTags: Tag[];
  initialPosts: ImagePost[];
}

export function ImageListClient({ initialTags, initialPosts }: ImageListClientProps) {
  const setContentMode = useUIStore((s) => s.setContentMode);
  const siteConfigCtx = useSiteConfig();

  useEffect(() => {
    setContentMode("image");
  }, [setContentMode]);

  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const { selectedSlugs, excludedSlugs, toggleTag, toggleExclude, clearAll, isSelected, isExcluded, hasFilter } =
    useTagFilter();
  const [page, setPage] = usePageParam();

  const { data: postData, isLoading } = trpc.image.list.useQuery(
    {
      limit: 20,
      page,
      sortBy,
      tagSlugs: selectedSlugs.length > 0 ? selectedSlugs : undefined,
      excludeTagSlugs: excludedSlugs.length > 0 ? excludedSlugs : undefined,
    },
    {
      placeholderData: (prev) => prev,
    },
  );

  const posts = useMemo(
    () => postData?.posts ?? (page === 1 && sortBy === "latest" && !hasFilter ? initialPosts : []),
    [postData?.posts, page, sortBy, hasFilter, initialPosts],
  );
  const totalPages = postData?.totalPages ?? 1;

  const adSeed = `image-${page}-${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { gridItems, pickedAds, hasAds } = useInlineAds<any>({
    items: posts,
    seed: adSeed,
  });

  const sortOptions = useMemo(() => {
    const enabledKeys = (siteConfigCtx?.imageSortOptions ?? "latest,views").split(",").map((s) => s.trim());
    return ALL_SORT_OPTIONS.filter((opt) => enabledKeys.includes(opt.id));
  }, [siteConfigCtx?.imageSortOptions]);

  return (
    <MotionPage direction="none">
      <div className="px-4 md:px-6 py-4 overflow-x-hidden">
        {/* 标签栏 */}
        <MotionPage>
          <CollapsibleTagBar className="mb-6">
            {sortOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setSortBy(option.id as SortBy);
                  setPage(1);
                }}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  sortBy === option.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
            {initialTags.length > 0 && (
              <>
                <div className="shrink-0 w-px bg-border my-1" />
                {initialTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      toggleTag(tag.slug);
                      setPage(1);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleExclude(tag.slug);
                      setPage(1);
                    }}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      isSelected(tag.slug) && "bg-foreground text-background",
                      isExcluded(tag.slug) && "bg-destructive/20 text-destructive line-through",
                      !isSelected(tag.slug) && !isExcluded(tag.slug) && "bg-muted hover:bg-muted/80 text-foreground",
                    )}
                    title="左键选择，右键排除"
                  >
                    {tag.name}
                  </button>
                ))}
              </>
            )}
          </CollapsibleTagBar>
        </MotionPage>

        {/* Content grid */}
        <section>
          <div key={`${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}-${page}`}>
            {isLoading && posts.length === 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : hasAds ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {gridItems.map((item, index) =>
                  item.type === "ad" ? (
                    <AdCard key={`ad-${item.adIndex}`} ad={pickedAds[item.adIndex]} />
                  ) : (
                    <ImagePostCard key={item.data.id} post={item.data} index={index} />
                  ),
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {posts.map((post, index) => (
                  <ImagePostCard key={post.id} post={post} index={index} />
                ))}
              </div>
            )}

            {!isLoading && posts.length === 0 && (
              <div className="text-center py-16">
                <div className="text-muted-foreground mb-4">
                  <Images className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">没有找到图片</p>
                  <p className="text-sm mt-1">{hasFilter ? "尝试调整标签筛选条件" : "暂无图片内容"}</p>
                </div>
                {hasFilter && (
                  <Button variant="outline" onClick={clearAll} className="mt-4">
                    清除筛选
                  </Button>
                )}
              </div>
            )}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
        </section>
      </div>
    </MotionPage>
  );
}
