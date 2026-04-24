"use client";

import { trpc } from "@/lib/trpc";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { AlertTriangle, X, Play, Layers } from "lucide-react";
import { MotionPage } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CollapsibleTagBar } from "@/components/ui/collapsible-tag-bar";
import { useTagFilter } from "@/hooks/use-tag-filter";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { useVideoCoverThumb } from "@/hooks/use-thumb";
import { AdCard } from "@/components/ads/ad-card";
import { HeaderBannerCarousel } from "@/components/ads/header-banner";
import { useInlineAds } from "@/hooks/use-inline-ads";
import type { Ad } from "@/lib/ads";
import { useUIStore } from "@/stores/app";
import { useSiteConfig } from "@/contexts/site-config";
import { Fragment, type ReactNode } from "react";
import { DEFAULT_HOME_LAYOUT, isSectionModuleEnabled, sectionGridClass, type SectionModuleId } from "@/lib/home-layout";

type ViewMode = "videos" | "series";
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

interface Video {
  id: string;
  title: string;
  coverUrl: string | null;
  coverBlurHash?: string | null;
  duration: number | null;
  views: number;
  createdAt: string;
  uploader: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  tags?: { tag: { id: string; name: string; slug: string } }[];
  _count: { likes: number; dislikes?: number; favorites?: number };
}

interface VideoListClientProps {
  initialTags: Tag[];
  initialVideos: Video[];
  siteConfig: {
    announcement: string | null;
    announcementEnabled: boolean;
  } | null;
  /** 服务端预选的广告（首页第一页 SSR 直出用） */
  initialAds?: Ad[];
}

export default function VideoListClient({
  initialTags,
  initialVideos,
  siteConfig,
  initialAds = [],
}: VideoListClientProps) {
  const setContentMode = useUIStore((s) => s.setContentMode);
  const siteConfigCtx = useSiteConfig();
  const sideListCover = useVideoCoverThumb("sideList");

  // 记录用户访问了视频区
  useEffect(() => {
    setContentMode("video");
  }, [setContentMode]);

  const [viewMode, setViewMode] = useState<ViewMode>("videos");
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const enabled = (siteConfigCtx?.videoSortOptions ?? "latest,views,likes").split(",").map((s) => s.trim());
    const configured = (siteConfigCtx?.videoDefaultSort as SortBy) || "latest";
    return enabled.includes(configured) ? configured : ((enabled[0] as SortBy) ?? "latest");
  });
  const { selectedSlugs, excludedSlugs, toggleTag, toggleExclude, clearAll, isSelected, isExcluded, hasFilter } =
    useTagFilter();
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [videoPage, setVideoPage] = usePageParam("page");
  const [seriesPage, setSeriesPage] = usePageParam("sp");

  const { data: videoData, isLoading: videoLoading } = trpc.video.list.useQuery(
    {
      limit: 20,
      page: videoPage,
      sortBy,
      tagSlugs: selectedSlugs.length > 0 ? selectedSlugs : undefined,
      excludeTagSlugs: excludedSlugs.length > 0 ? excludedSlugs : undefined,
    },
    {
      enabled: viewMode === "videos",
      placeholderData: (prev) => prev,
    },
  );

  // 合集列表查询
  const { data: seriesData, isLoading: seriesLoading } = trpc.series.list.useQuery(
    { limit: 12, page: seriesPage },
    {
      enabled: viewMode === "series",
      placeholderData: (prev) => prev,
    },
  );

  // 数据（用 useMemo 稳定引用，避免下游 useMemo 依赖在每次渲染时变化）
  const videos = useMemo(
    () => videoData?.videos ?? (videoPage === 1 ? initialVideos : []),
    [videoData?.videos, videoPage, initialVideos],
  );
  const videoTotalPages = videoData?.totalPages ?? 1;
  const series = seriesData?.items ?? [];
  const seriesTotalPages = seriesData?.totalPages ?? 1;

  const isFirstPage = videoPage === 1 && !hasFilter;
  const adSeed = `${videoPage}-${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}`;
  const layout = siteConfigCtx?.homeLayout ?? DEFAULT_HOME_LAYOUT;
  const adDensity = layout.section.adDensity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { gridItems, pickedAds, hasAds } = useInlineAds<any>({
    items: videos,
    seed: adSeed,
    initialAds: adDensity === 0 ? [] : initialAds,
    useInitialAds: isFirstPage && initialAds.length > 0 && adDensity > 0,
    count: adDensity === 0 ? 0 : 4,
    interval: adDensity === 0 ? 9999 : adDensity,
  });
  const gridClass = sectionGridClass(layout.section.gridColumns);

  // 视图模式选项
  const viewModeOptions: { id: ViewMode; label: string }[] = [
    { id: "videos", label: "视频" },
    { id: "series", label: "作者" },
  ];

  const sortOptions = useMemo(() => {
    const enabledKeys = (siteConfigCtx?.videoSortOptions ?? "latest,views,likes").split(",").map((s) => s.trim());
    return ALL_SORT_OPTIONS.filter((opt) => enabledKeys.includes(opt.id));
  }, [siteConfigCtx?.videoSortOptions]);

  const handleViewModeClick = useCallback(
    (id: ViewMode) => {
      setViewMode(id);
      if (id === "series") {
        clearAll();
      }
    },
    [clearAll],
  );

  const handleSortClick = useCallback(
    (id: SortBy) => {
      setSortBy(id);
      setVideoPage(1);
    },
    [setVideoPage],
  );

  const handleTagClick = useCallback(
    (slug: string) => {
      if (viewMode === "series") return;
      toggleTag(slug);
      setVideoPage(1);
    },
    [viewMode, toggleTag, setVideoPage],
  );

  const handleTagRightClick = useCallback(
    (e: React.MouseEvent, slug: string) => {
      e.preventDefault();
      if (viewMode === "series") return;
      toggleExclude(slug);
      setVideoPage(1);
    },
    [viewMode, toggleExclude, setVideoPage],
  );

  const modules: Record<SectionModuleId, ReactNode> = {
    headerBanner: <HeaderBannerCarousel className="mb-4" />,
    announcement:
      siteConfig?.announcementEnabled && siteConfig.announcement ? (
        <div
          className={`mb-4 relative overflow-hidden transition-all duration-300 ${
            showAnnouncement ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400 flex-1">{siteConfig.announcement}</p>
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
          {viewModeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleViewModeClick(option.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                viewMode === option.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
          <div className="shrink-0 w-px bg-border my-1" />
          {viewMode === "videos" &&
            sortOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSortClick(option.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  sortBy === option.id ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80 text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          {viewMode === "videos" && initialTags.length > 0 && (
            <>
              <div className="shrink-0 w-px bg-border my-1" />
              {initialTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag.slug)}
                  onContextMenu={(e) => handleTagRightClick(e, tag.slug)}
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
        {viewMode === "videos" ? (
          // 视频网格
          <>
            <div key={`${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}-${videoPage}`}>
              {videoLoading && videos.length === 0 ? (
                <VideoGrid videos={[]} isLoading columnsClass={gridClass} />
              ) : hasAds ? (
                <div className={cn("grid gap-3 sm:gap-4 lg:gap-5", gridClass)}>
                  {gridItems.map((item, index) =>
                    item.type === "ad" ? (
                      <AdCard key={`ad-${item.adIndex}`} ad={pickedAds[item.adIndex]} slotId="in-feed" />
                    ) : (
                      <VideoCard key={item.data.id} video={item.data} index={index} />
                    ),
                  )}
                </div>
              ) : (
                <VideoGrid videos={videos} isLoading={false} columnsClass={gridClass} />
              )}

              {/* 无结果提示 */}
              {!videoLoading && videos.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-muted-foreground mb-4">
                    <p className="text-lg font-medium">没有找到视频</p>
                    <p className="text-sm mt-1">{hasFilter ? "尝试调整标签筛选条件" : "暂无视频内容"}</p>
                  </div>
                  {hasFilter && (
                    <Button variant="outline" onClick={clearAll} className="mt-4">
                      清除筛选
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 分页器 */}
            <Pagination
              currentPage={videoPage}
              totalPages={videoTotalPages}
              onPageChange={setVideoPage}
              className="mt-8"
            />
          </>
        ) : (
          // 合集网格
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {seriesLoading && series.length === 0
                ? // 加载骨架屏
                  Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="aspect-video w-full" />
                      <CardContent className="p-3 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardContent>
                    </Card>
                  ))
                : series.map((s) => (
                    <Link key={s.id} href={`/series/${s.id}`}>
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                        {/* 合集封面 - 2x2 网格预览 */}
                        <div className="relative aspect-video bg-muted">
                          {s.previewVideos.length > 0 ? (
                            <div className="grid grid-cols-2 grid-rows-2 h-full">
                              {[0, 1, 2, 3].map((idx) => {
                                const video = s.previewVideos[idx];
                                return (
                                  <div key={idx} className="relative overflow-hidden">
                                    {video ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={sideListCover(video.id, video.coverUrl)}
                                        alt={video.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-muted flex items-center justify-center">
                                        <Play className="w-6 h-6 text-muted-foreground/50" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : s.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Layers className="w-12 h-12 text-muted-foreground/30" />
                            </div>
                          )}

                          {/* 集数徽章 */}
                          <Badge className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/70 text-white">
                            {s.episodeCount} 集
                          </Badge>

                          {/* 悬停遮罩 */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        <CardContent className="p-3">
                          <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                            {s.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <span>{s.creator.nickname || s.creator.username}</span>
                            <span>·</span>
                            <span>{s.totalViews.toLocaleString()} 播放</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
            </div>

            {/* 无结果提示 */}
            {!seriesLoading && series.length === 0 && (
              <div className="text-center py-16">
                <div className="text-muted-foreground mb-4">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无合集</p>
                  <p className="text-sm mt-1">还没有创建任何视频合集</p>
                </div>
              </div>
            )}

            {/* 分页器 */}
            <Pagination
              currentPage={seriesPage}
              totalPages={seriesTotalPages}
              onPageChange={setSeriesPage}
              className="mt-8"
            />
          </>
        )}
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
