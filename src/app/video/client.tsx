"use client";

import { trpc } from "@/lib/trpc";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { usePageParam } from "@/hooks/use-page-param";
import { AlertTriangle, X, Play, User2, Layers } from "lucide-react";
import { MotionPage } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CollapsibleTagBar } from "@/components/ui/collapsible-tag-bar";
import { SectionTabs, type SectionTabItem } from "@/components/shared/section-tabs";
import { SidebarRanking } from "@/components/shared/sidebar-ranking";
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

type ViewMode = "videos" | "authors";
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL ?author=xxx 用作"按原作者筛选"，由作者卡片点击时设置
  const authorFilter = searchParams.get("author") || "";

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
  const [authorsPage, setAuthorsPage] = usePageParam("ap");

  const { data: videoData, isLoading: videoLoading } = trpc.video.list.useQuery(
    {
      limit: 20,
      page: videoPage,
      sortBy,
      tagSlugs: selectedSlugs.length > 0 ? selectedSlugs : undefined,
      excludeTagSlugs: excludedSlugs.length > 0 ? excludedSlugs : undefined,
      author: authorFilter || undefined,
    },
    {
      enabled: viewMode === "videos",
      placeholderData: (prev) => prev,
    },
  );

  // 原作者聚合查询：列表页"作者"tab 用，按 extraInfo.author 分组
  const { data: authorsData, isLoading: authorsLoading } = trpc.video.listAuthors.useQuery(
    { limit: 12, page: authorsPage, sortBy: "videoCount" },
    {
      enabled: viewMode === "authors",
      placeholderData: (prev) => prev,
    },
  );

  // 数据（用 useMemo 稳定引用，避免下游 useMemo 依赖在每次渲染时变化）。
  // 仅在无筛选 (无 tag、无原作者) 的首页 SSR 场景使用 initialVideos 占位，
  // 否则等待 client query 返回。
  const videos = useMemo(
    () => videoData?.videos ?? (videoPage === 1 && !hasFilter && !authorFilter ? initialVideos : []),
    [videoData?.videos, videoPage, hasFilter, authorFilter, initialVideos],
  );
  const videoTotalPages = videoData?.totalPages ?? 1;
  const authorItems = authorsData?.items ?? [];
  const authorsTotalPages = authorsData?.totalPages ?? 1;

  const isFirstPage = videoPage === 1 && !hasFilter && !authorFilter;
  const adSeed = `${videoPage}-${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}-${authorFilter}`;
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
    { id: "authors", label: "作者" },
  ];

  const sortOptions = useMemo(() => {
    const enabledKeys = (siteConfigCtx?.videoSortOptions ?? "latest,views,likes").split(",").map((s) => s.trim());
    return ALL_SORT_OPTIONS.filter((opt) => enabledKeys.includes(opt.id));
  }, [siteConfigCtx?.videoSortOptions]);

  const handleViewModeClick = useCallback(
    (id: ViewMode) => {
      setViewMode(id);
      if (id === "authors") {
        // 切到"作者"聚合视图时，清空 tag 筛选与 author URL 参数（避免视图错乱）
        clearAll();
        if (authorFilter) {
          const params = new URLSearchParams(window.location.search);
          params.delete("author");
          const qs = params.toString();
          router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
        }
      }
    },
    [clearAll, authorFilter, pathname, router],
  );

  /** 清除"按原作者筛选"过滤条件 */
  const handleClearAuthorFilter = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("author");
    params.delete("page");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, router]);

  const handleSortClick = useCallback(
    (id: SortBy) => {
      setSortBy(id);
      setVideoPage(1);
    },
    [setVideoPage],
  );

  const handleTagClick = useCallback(
    (slug: string) => {
      if (viewMode === "authors") return;
      setVideoPage(1);
      toggleTag(slug);
    },
    [viewMode, toggleTag, setVideoPage],
  );

  const handleTagRightClick = useCallback(
    (e: React.MouseEvent, slug: string) => {
      e.preventDefault();
      if (viewMode === "authors") return;
      setVideoPage(1);
      toggleExclude(slug);
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
        {viewMode === "videos" && sortOptions.length > 0 && (
          <SectionTabs<SortBy>
            className="mb-3"
            tabs={sortOptions as SectionTabItem<SortBy>[]}
            value={sortBy}
            onChange={handleSortClick}
            trailing={
              <div className="flex items-center gap-1 rounded-full bg-muted/60 p-0.5">
                {viewModeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleViewModeClick(option.id)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
                      viewMode === option.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            }
          />
        )}
        {viewMode === "authors" && (
          <div className="mb-3 border-b border-border/60 pb-2">
            <div className="flex items-center gap-1 rounded-full bg-muted/60 p-0.5 w-fit">
              {viewModeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleViewModeClick(option.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
                    viewMode === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 当前正在按某位原作者筛选时显示横幅 */}
        {viewMode === "videos" && authorFilter && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-primary/8 border border-primary/20 px-4 py-2.5">
            <User2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm flex-1 min-w-0 truncate">
              正在按原作者筛选：<strong className="font-semibold">{authorFilter}</strong>
            </span>
            <button
              type="button"
              onClick={handleClearAuthorFilter}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              清除
            </button>
          </div>
        )}
        {viewMode === "videos" && initialTags.length > 0 && (
          <CollapsibleTagBar className="mb-6">
            {initialTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.slug)}
                onContextMenu={(e) => handleTagRightClick(e, tag.slug)}
                className={cn(
                  "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border",
                  isSelected(tag.slug) && "bg-primary text-primary-foreground border-primary",
                  isExcluded(tag.slug) && "bg-destructive/15 text-destructive line-through border-destructive/30",
                  !isSelected(tag.slug) &&
                    !isExcluded(tag.slug) &&
                    "bg-card hover:bg-accent text-foreground border-border",
                )}
                title="左键选择，右键排除"
              >
                {tag.name}
              </button>
            ))}
          </CollapsibleTagBar>
        )}
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
          // 原作者聚合网格：按 extraInfo.author 分组，点击进入该作者作品筛选
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {authorsLoading && authorItems.length === 0
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
                : authorItems.map((a) => (
                    <Link
                      key={a.author}
                      href={`/video?author=${encodeURIComponent(a.author)}`}
                      onClick={() => setViewMode("videos")}
                    >
                      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                        {/* 作者代表作 2×2 网格预览 */}
                        <div className="relative aspect-video bg-muted">
                          {a.previewVideos.length > 0 ? (
                            <div className="grid grid-cols-2 grid-rows-2 h-full">
                              {[0, 1, 2, 3].map((idx) => {
                                const video = a.previewVideos[idx];
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
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User2 className="w-12 h-12 text-muted-foreground/30" />
                            </div>
                          )}

                          {/* 视频数徽章 */}
                          <Badge className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/70 text-white">
                            {a.videoCount} 个作品
                          </Badge>

                          {/* 悬停遮罩 */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        <CardContent className="p-3">
                          <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <User2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{a.author}</span>
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <span>{a.videoCount} 个作品</span>
                            <span>·</span>
                            <span>{a.totalViews.toLocaleString()} 播放</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
            </div>

            {/* 无结果提示 */}
            {!authorsLoading && authorItems.length === 0 && (
              <div className="text-center py-16">
                <div className="text-muted-foreground mb-4">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无原作者数据</p>
                  <p className="text-sm mt-1">投稿时填写「原作者」后，将自动出现在此</p>
                </div>
              </div>
            )}

            {/* 分页器 */}
            <Pagination
              currentPage={authorsPage}
              totalPages={authorsTotalPages}
              onPageChange={setAuthorsPage}
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
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            {layout.section.modules.map((m) => {
              if (!isSectionModuleEnabled(layout, m.id)) return null;
              const node = modules[m.id];
              if (!node) return null;
              return <Fragment key={m.id}>{node}</Fragment>;
            })}
          </div>
          {viewMode === "videos" && (
            <aside className="hidden xl:block w-[300px] shrink-0">
              <div className="sticky top-[6.5rem]">
                <SidebarRanking kind="video" />
              </div>
            </aside>
          )}
        </div>
      </div>
    </MotionPage>
  );
}
