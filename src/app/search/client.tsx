"use client";

import { trpc } from "@/lib/trpc";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { GameGrid } from "@/components/game/game-grid";
import { GameCard } from "@/components/game/game-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { useTabParam } from "@/hooks/use-tab-param";
import { Search, Clock, TrendingUp, X, Play, Gamepad2, Images, Tag, type LucideIcon } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { useRouter } from "next/navigation";
import { useSearchHistoryStore } from "@/stores/app";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AdCard } from "@/components/ads/ad-card";
import { useInlineAds } from "@/hooks/use-inline-ads";

interface SearchContentProps {
  query: string;
}

type SearchTab = "video" | "game" | "image" | "tag";
type SortBy = "latest" | "views" | "likes";
type TimeRange = "all" | "today" | "week" | "month";

const TAB_OPTIONS: { value: SearchTab; label: string; icon: LucideIcon }[] = [
  { value: "video", label: "视频", icon: Play },
  { value: "game", label: "游戏", icon: Gamepad2 },
  { value: "image", label: "图片", icon: Images },
  { value: "tag", label: "标签", icon: Tag },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "latest", label: "最新" },
  { value: "views", label: "最多播放" },
  { value: "likes", label: "最多点赞" },
];

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "all", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
];

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-foreground text-background"
          : "bg-muted hover:bg-muted/80 text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function SearchExplore() {
  const router = useRouter();
  const { history: searchHistory, removeSearch, clearHistory } = useSearchHistoryStore();

  const { data: hotSearches } = trpc.video.getHotSearches.useQuery(
    { limit: 10 },
    { staleTime: 300000 }
  );

  const goSearch = (keyword: string) => {
    router.push(`/search?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      {searchHistory.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              搜索历史
            </h2>
            <button
              onClick={clearHistory}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              全部清除
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.slice(0, 12).map((keyword) => (
              <button
                key={keyword}
                onClick={() => goSearch(keyword)}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-sm transition-colors"
              >
                <span>{keyword}</span>
                <X
                  className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                  onClick={(e) => { e.stopPropagation(); removeSearch(keyword); }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {hotSearches && hotSearches.length > 0 && (
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4" />
            热搜榜
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {hotSearches.map((item, index) => (
              <button
                key={item.keyword}
                onClick={() => goSearch(item.keyword)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-left transition-colors"
              >
                <span
                  className={cn(
                    "w-6 text-center text-sm font-bold",
                    index < 3 ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-sm truncate">{item.keyword}</span>
                {item.isHot && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">
                    热
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchHistory.length === 0 && (!hotSearches || hotSearches.length === 0) && (
        <div className="text-center py-16">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <h1 className="text-xl font-semibold mt-4">搜索</h1>
          <p className="text-muted-foreground mt-2 text-sm">在顶部搜索框中输入关键词开始搜索</p>
        </div>
      )}
    </div>
  );
}

const contentTypeLabels: Record<SearchTab, string> = {
  video: "视频",
  game: "游戏",
  image: "图片",
  tag: "标签",
};

export function SearchContent({ query }: SearchContentProps) {
  const [searchTab, setSearchTab] = useTabParam<SearchTab>("video");
  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [videoPage, setVideoPage] = usePageParam("page");
  const [gamePage, setGamePage] = usePageParam("gp");
  const [imagePage, setImagePage] = usePageParam("ip");

  const showFilters = searchTab === "video" || searchTab === "game";

  const { data: videoData, isLoading: videoLoading } = trpc.video.list.useQuery(
    { limit: 20, page: videoPage, search: query, sortBy, timeRange },
    { enabled: !!query && searchTab === "video", placeholderData: (prev) => prev }
  );

  const { data: gameData, isLoading: gameLoading } = trpc.game.list.useQuery(
    { limit: 20, page: gamePage, search: query, sortBy, timeRange },
    { enabled: !!query && searchTab === "game", placeholderData: (prev) => prev }
  );

  const { data: imageData, isLoading: imageLoading } = trpc.image.list.useQuery(
    { limit: 20, page: imagePage, search: query, sortBy: sortBy === "likes" ? "latest" : sortBy },
    { enabled: !!query && searchTab === "image", placeholderData: (prev) => prev }
  );

  const { data: tagData, isLoading: tagLoading } = trpc.tag.list.useQuery(
    { search: query, limit: 50 },
    { enabled: !!query && searchTab === "tag" }
  );

  const videos = videoData?.videos ?? [];
  const videoTotalCount = videoData?.totalCount ?? 0;
  const videoTotalPages = videoData?.totalPages ?? 1;

  const games = gameData?.games ?? [];
  const gameTotalCount = gameData?.totalCount ?? 0;
  const gameTotalPages = gameData?.totalPages ?? 1;

  const posts = imageData?.posts ?? [];
  const imageTotalCount = imageData?.totalCount ?? 0;
  const imageTotalPages = imageData?.totalPages ?? 1;

  const tags = tagData ?? [];

  const videoAdSeed = `search-video-${query}-${videoPage}-${sortBy}-${timeRange}`;
  const { gridItems: videoGridItems, pickedAds: videoPickedAds, hasAds: videoHasAds } = useInlineAds({
    items: videos,
    count: 2,
    seed: videoAdSeed,
  });

  const gameAdSeed = `search-game-${query}-${gamePage}-${sortBy}-${timeRange}`;
  const { gridItems: gameGridItems, pickedAds: gamePickedAds, hasAds: gameHasAds } = useInlineAds({
    items: games,
    count: 2,
    seed: gameAdSeed,
  });

  const imageAdSeed = `search-image-${query}-${imagePage}`;
  const { gridItems: imageGridItems, pickedAds: imagePickedAds, hasAds: imageHasAds } = useInlineAds({
    items: posts,
    count: 2,
    seed: imageAdSeed,
  });

  const currentLoading = {
    video: videoLoading,
    game: gameLoading,
    image: imageLoading,
    tag: tagLoading,
  }[searchTab];

  const currentTotalCount = {
    video: videoTotalCount,
    game: gameTotalCount,
    image: imageTotalCount,
    tag: tags.length,
  }[searchTab];

  const currentPage = { video: videoPage, game: gamePage, image: imagePage, tag: 1 }[searchTab];
  const currentSetPage = { video: setVideoPage, game: setGamePage, image: setImagePage, tag: () => {} }[searchTab];
  const currentTotalPages = { video: videoTotalPages, game: gameTotalPages, image: imageTotalPages, tag: 1 }[searchTab];

  if (!query) {
    return <SearchExplore />;
  }

  return (
    <div className="px-4 md:px-6 py-6">
      <div className="mb-4">
        <p className="text-muted-foreground text-sm">
          搜索 &quot;{query}&quot;
          {!currentLoading && (
            <span className="ml-1">
              - 共 {currentTotalCount} 个{contentTypeLabels[searchTab]}
            </span>
          )}
        </p>
      </div>

      <div className="flex gap-1 mb-4">
        {TAB_OPTIONS.map((tab) => {
          const Icon = tab.icon;
          const isActive = searchTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setSearchTab(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          {SORT_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={sortBy === option.value}
              onClick={() => { setSortBy(option.value); currentSetPage(1); }}
            />
          ))}
          <div className="w-px bg-border shrink-0 my-1" />
          {TIME_RANGE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={timeRange === option.value}
              onClick={() => { setTimeRange(option.value); currentSetPage(1); }}
            />
          ))}
        </div>
      )}

      {/* 视频结果 */}
      {searchTab === "video" && (
        <>
          {currentLoading ? (
            <VideoGrid videos={[]} isLoading />
          ) : videoHasAds ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {videoGridItems.map((item, index) =>
                item.type === "ad" ? (
                  <AdCard key={`ad-${item.adIndex}`} ad={videoPickedAds[item.adIndex]} />
                ) : (
                  <VideoCard key={item.data.id} video={item.data} index={index} />
                )
              )}
            </div>
          ) : (
            <VideoGrid videos={videos} isLoading={false} />
          )}
          {currentTotalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={currentTotalPages} onPageChange={currentSetPage} className="mt-8" />
          )}
          {!currentLoading && videos.length === 0 && (
            <EmptyResult icon={Search} label="视频" sortBy={sortBy} timeRange={timeRange} onClear={() => { setSortBy("latest"); setTimeRange("all"); }} />
          )}
        </>
      )}

      {/* 游戏结果 */}
      {searchTab === "game" && (
        <>
          {currentLoading ? (
            <GameGrid games={[]} isLoading columns={4} />
          ) : gameHasAds ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {gameGridItems.map((item, index) =>
                item.type === "ad" ? (
                  <AdCard key={`ad-${item.adIndex}`} ad={gamePickedAds[item.adIndex]} />
                ) : (
                  <GameCard key={item.data.id} game={item.data} index={index} />
                )
              )}
            </div>
          ) : (
            <GameGrid games={games} isLoading={false} columns={4} />
          )}
          {currentTotalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={currentTotalPages} onPageChange={currentSetPage} className="mt-8" />
          )}
          {!currentLoading && games.length === 0 && (
            <EmptyResult icon={Gamepad2} label="游戏" sortBy={sortBy} timeRange={timeRange} onClear={() => { setSortBy("latest"); setTimeRange("all"); }} />
          )}
        </>
      )}

      {/* 图片结果 */}
      {searchTab === "image" && (
        <>
          {currentLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : imageHasAds ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {imageGridItems.map((item, index) =>
                item.type === "ad" ? (
                  <AdCard key={`ad-${item.adIndex}`} ad={imagePickedAds[item.adIndex]} />
                ) : (
                  <ImagePostCard key={item.data.id} post={item.data} index={index} />
                )
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {posts.map((post, index) => (
                <ImagePostCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
          {currentTotalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={currentTotalPages} onPageChange={currentSetPage} className="mt-8" />
          )}
          {!currentLoading && posts.length === 0 && (
            <EmptyResult icon={Images} label="图片" sortBy="latest" timeRange="all" onClear={() => {}} />
          )}
        </>
      )}

      {/* 标签结果 */}
      {searchTab === "tag" && (
        <>
          {tagLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const count =
                  (tag.videoCount ?? 0) + (tag.gameCount ?? 0) + (tag.imagePostCount ?? 0);
                return (
                  <Link
                    key={tag.id}
                    href={`/tag/${tag.slug}`}
                    className="transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95"
                  >
                    <Badge
                      variant="outline"
                      className="text-sm py-2 px-4 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Tag className="h-3.5 w-3.5 mr-1.5" />
                      {tag.name}
                      {count > 0 && <span className="ml-1.5 opacity-60">({count})</span>}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Tag className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">没有找到相关标签</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyResult({
  icon: Icon,
  label,
  sortBy,
  timeRange,
  onClear,
}: {
  icon: LucideIcon;
  label: string;
  sortBy: SortBy;
  timeRange: TimeRange;
  onClear: () => void;
}) {
  return (
    <div className="text-center py-16">
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
      <p className="text-muted-foreground">没有找到相关{label}</p>
      {(sortBy !== "latest" || timeRange !== "all") && (
        <Button variant="link" onClick={onClear} className="mt-2">
          清除筛选条件重试
        </Button>
      )}
    </div>
  );
}
