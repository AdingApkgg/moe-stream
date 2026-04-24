"use client";

import { trpc } from "@/lib/trpc";
import { ImagePostCard } from "@/components/image/image-post-card";
import { Button } from "@/components/ui/button";
import { Fragment, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { AlertTriangle, Images, X } from "lucide-react";
import { MotionPage } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CollapsibleTagBar } from "@/components/ui/collapsible-tag-bar";
import { useTagFilter } from "@/hooks/use-tag-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { AdCard } from "@/components/ads/ad-card";
import { HeaderBannerCarousel } from "@/components/ads/header-banner";
import { useInlineAds } from "@/hooks/use-inline-ads";
import { useUIStore } from "@/stores/app";
import { useSiteConfig } from "@/contexts/site-config";
import { DEFAULT_HOME_LAYOUT, isSectionModuleEnabled, sectionGridClass, type SectionModuleId } from "@/lib/home-layout";

type SortBy = "latest" | "views" | "likes" | "titleAsc" | "titleDesc";

const ALL_SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "latest", label: "最新" },
  { id: "views", label: "热门" },
  { id: "likes", label: "高赞" },
  { id: "titleAsc", label: "标题 A→Z" },
  { id: "titleDesc", label: "标题 Z→A" },
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

  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const enabled = (siteConfigCtx?.imageSortOptions ?? "latest,views").split(",").map((s) => s.trim());
    const configured = (siteConfigCtx?.imageDefaultSort as SortBy) || "latest";
    return enabled.includes(configured) ? configured : ((enabled[0] as SortBy) ?? "latest");
  });
  const { selectedSlugs, excludedSlugs, toggleTag, toggleExclude, clearAll, isSelected, isExcluded, hasFilter } =
    useTagFilter();
  const [page, setPage] = usePageParam();

  // 不再使用 placeholderData：翻页 / 切换排序 / 切换筛选时立即清空旧内容 → 显示骨架屏，
  // 避免用户以为「页面没反应」，也能让浏览器尽快释放旧图片请求、开始加载新页
  const {
    data: postData,
    isLoading,
    isFetching,
  } = trpc.image.list.useQuery({
    limit: 20,
    page,
    sortBy,
    tagSlugs: selectedSlugs.length > 0 ? selectedSlugs : undefined,
    excludeTagSlugs: excludedSlugs.length > 0 ? excludedSlugs : undefined,
  });

  const posts = useMemo(
    () => postData?.posts ?? (page === 1 && !hasFilter && isLoading ? initialPosts : []),
    [postData?.posts, page, hasFilter, initialPosts, isLoading],
  );
  const totalPages = postData?.totalPages ?? 1;
  const showSkeleton = (isLoading || isFetching) && posts.length === 0;

  const handlePageChange = useCallback(
    (next: number) => {
      setPage(next);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    },
    [setPage],
  );

  const adSeed = `image-${page}-${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}`;
  const layout = siteConfigCtx?.homeLayout ?? DEFAULT_HOME_LAYOUT;
  const adDensity = layout.section.adDensity;
  const gridClass = sectionGridClass(layout.section.gridColumns);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { gridItems, pickedAds, hasAds } = useInlineAds<any>({
    items: posts,
    seed: adSeed,
    count: adDensity === 0 ? 0 : 4,
    interval: adDensity === 0 ? 9999 : adDensity,
  });

  const sortOptions = useMemo(() => {
    const enabledKeys = (siteConfigCtx?.imageSortOptions ?? "latest,views").split(",").map((s) => s.trim());
    return ALL_SORT_OPTIONS.filter((opt) => enabledKeys.includes(opt.id));
  }, [siteConfigCtx?.imageSortOptions]);

  const modules: Record<SectionModuleId, ReactNode> = {
    headerBanner: <HeaderBannerCarousel className="mb-4" />,
    announcement:
      siteConfigCtx?.announcementEnabled && siteConfigCtx.announcement ? (
        <div
          className={`mb-4 relative overflow-hidden transition-all duration-300 ${
            showAnnouncement ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex-1">{siteConfigCtx.announcement}</p>
            <button
              onClick={() => setShowAnnouncement(false)}
              className="text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all hover:scale-110 active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null,
    tagBar: (
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
    ),
    mainGrid: (
      <section>
        <div key={`${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}-${page}`}>
          {showSkeleton ? (
            <div className={cn("grid gap-3 sm:gap-4 lg:gap-5", gridClass)}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : hasAds ? (
            <div className={cn("grid gap-3 sm:gap-4 lg:gap-5", gridClass)}>
              {gridItems.map((item, index) =>
                item.type === "ad" ? (
                  <AdCard key={`ad-${item.adIndex}`} ad={pickedAds[item.adIndex]} slotId="in-feed" />
                ) : (
                  <ImagePostCard key={item.data.id} post={item.data} index={index} />
                ),
              )}
            </div>
          ) : (
            <div className={cn("grid gap-3 sm:gap-4 lg:gap-5", gridClass)}>
              {posts.map((post, index) => (
                <ImagePostCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}

          {!isLoading && !isFetching && posts.length === 0 && (
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

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} className="mt-8" />
      </section>
    ),
  };

  return (
    <MotionPage direction="none">
      <div className="px-4 md:px-6 py-4 overflow-x-hidden">
        {layout.section.modules.map((m) => {
          if (!isSectionModuleEnabled(layout, m.id)) return null;
          const node = modules[m.id];
          if (!node) return null;
          return <Fragment key={m.id}>{node}</Fragment>;
        })}
      </div>
    </MotionPage>
  );
}
